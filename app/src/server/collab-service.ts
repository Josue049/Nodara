/**
 * Edición colaborativa en tiempo real con Yjs (CRDT).
 *
 * Transporte: Server‑Sent Events para recibir (sincronización inicial, actualizaciones, presencia) y POST para enviar.
 * Funciona sobre `next start` sin servidor WebSocket propio. Estado en memoria por proceso (un proceso de servidor);
 * para varias réplicas haría falta un bus (p. ej. LISTEN/NOTIFY de Postgres) — ver docs/ARCHITECTURE.md.
 *
 * Fuente de verdad mientras alguien edita: el documento Yjs, persistido en `page_ydocs`. Además se vuelca a
 * `pages.content` / `content_text` (búsqueda, exportación, versiones) y se detectan menciones nuevas.
 */
import { getSchema, type JSONContent } from "@tiptap/core";
import { prosemirrorJSONToYDoc, yDocToProsemirrorJSON } from "@tiptap/y-tiptap";
import { eq } from "drizzle-orm";
import { applyAwarenessUpdate, Awareness, encodeAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness";
import * as Y from "yjs";
import { schemaExtensions } from "@/lib/editor/schema";
import { notifyUsers } from "./comments-service";
import type { Db } from "./db";
import { extractText } from "./pages-service";
import { pageYdocs, pages } from "./schema";
import { maybeSnapshot } from "./sharing-service";

const FIELD = "default";
const PERSIST_DELAY_MS = Number(process.env.NODARA_COLLAB_PERSIST_MS ?? 800);
const IDLE_CLOSE_MS = 60_000;

export type SendFn = (event: string, data: unknown) => void;
type Client = { id: string; userId: string; awarenessId: number; send: SendFn };
type Room = {
  pageId: string;
  doc: Y.Doc;
  awareness: Awareness;
  clients: Map<string, Client>;
  ready: Promise<void>;
  persistTimer: ReturnType<typeof setTimeout> | null;
  closeTimer: ReturnType<typeof setTimeout> | null;
  dirty: boolean;
  lastEditor: string | null;
  mentions: Set<string>;
  closed: boolean;
  /**
   * Vuelca la sala con el módulo que la creó. Cada ruta de Next empaqueta su propia copia de Yjs y la conversión a JSON
   * falla («Unexpected case») si se hace con otra copia, así que otras rutas vuelcan siempre a través de esta función.
   */
  flush: () => Promise<void>;
};

const g = globalThis as unknown as { __nodaraRooms?: Map<string, Room> };
const rooms = (g.__nodaraRooms ??= new Map());

let schema: ReturnType<typeof getSchema> | null = null;
const pmSchema = () => (schema ??= getSchema(schemaExtensions({ collaborative: true })));

export const toBase64 = (u: Uint8Array) => Buffer.from(u).toString("base64");
export const fromBase64 = (s: string) => new Uint8Array(Buffer.from(s, "base64"));

const mentionIds = (json: JSONContent | null | undefined): Set<string> => {
  const out = new Set<string>();
  const walk = (n?: JSONContent) => {
    if (!n) return;
    if (n.type === "mention" && typeof n.attrs?.id === "string") out.add(n.attrs.id);
    n.content?.forEach(walk);
  };
  walk(json ?? undefined);
  return out;
};

async function loadRoom(db: Db, room: Room) {
  const [stored] = await db.select().from(pageYdocs).where(eq(pageYdocs.pageId, room.pageId));
  const [page] = await db.select({ content: pages.content }).from(pages).where(eq(pages.id, room.pageId));
  if (stored) Y.applyUpdate(room.doc, stored.state);
  else if (page?.content && (page.content as { type?: string }).type === "doc") {
    // Primera edición colaborativa: se siembra el documento con el contenido guardado.
    const seeded = prosemirrorJSONToYDoc(pmSchema(), page.content as JSONContent, FIELD);
    Y.applyUpdate(room.doc, Y.encodeStateAsUpdate(seeded));
    room.dirty = true;
  }
  room.mentions = mentionIds(yDocToProsemirrorJSON(room.doc, FIELD));
}

export function getRoom(db: Db, pageId: string): Room {
  let room = rooms.get(pageId);
  if (room && !room.closed) return room;
  const doc = new Y.Doc();
  const awareness = new Awareness(new Y.Doc());
  awareness.setLocalState(null); // el servidor no es un participante
  room = { pageId, doc, awareness, clients: new Map(), ready: Promise.resolve(), persistTimer: null, closeTimer: null, dirty: false, lastEditor: null, mentions: new Set(), closed: false, flush: async () => {} };
  const r = room;
  r.flush = () => persist(db, r);
  r.ready = loadRoom(db, r).then(() => {
    if (r.dirty) schedulePersist(db, r);
  });
  rooms.set(pageId, room);
  return room;
}

function schedulePersist(db: Db, room: Room) {
  room.dirty = true;
  if (room.persistTimer) clearTimeout(room.persistTimer);
  room.persistTimer = setTimeout(() => void persist(db, room), PERSIST_DELAY_MS);
}

/** Vuelca el estado Yjs a la base y al contenido JSON de la página. */
export async function persist(db: Db, room: Room): Promise<void> {
  if (room.persistTimer) clearTimeout(room.persistTimer);
  room.persistTimer = null;
  if (!room.dirty || room.closed) return;
  room.dirty = false;
  const state = Y.encodeStateAsUpdate(room.doc);
  const json = yDocToProsemirrorJSON(room.doc, FIELD);
  try {
    await db.transaction(async (tx) => {
      await tx.insert(pageYdocs).values({ pageId: room.pageId, state }).onConflictDoUpdate({ target: pageYdocs.pageId, set: { state, updatedAt: new Date() } });
      await tx.update(pages).set({ content: json as object, contentText: extractText(json), updatedAt: new Date() }).where(eq(pages.id, room.pageId));
    });
    await maybeSnapshot(db, room.pageId, room.lastEditor);
    const fresh = mentionIds(json);
    const added = [...fresh].filter((id) => !room.mentions.has(id));
    room.mentions = fresh;
    if (added.length) await notifyUsers(db, { userIds: added, actorId: room.lastEditor, pageId: room.pageId, type: "mention", preview: extractText(json) });
  } catch (e) {
    room.dirty = true; // se reintentará con el siguiente cambio
    console.error("collab: no se pudo guardar", e);
  }
}

export async function flushRoom(pageId: string): Promise<void> {
  await rooms.get(pageId)?.flush();
}

/** Vuelca todas las salas con cambios pendientes (antes de una copia de seguridad completa). */
export async function flushAllRooms(): Promise<void> {
  await Promise.all([...rooms.values()].map((room) => room.flush()));
}

// ── Conexión de clientes ─────────────────────────────────────────────

/** Registra un cliente (conexión SSE). Devuelve la función de desconexión. */
export async function connect(db: Db, pageId: string, client: Client): Promise<() => Promise<void>> {
  const room = getRoom(db, pageId);
  await room.ready;
  if (room.closeTimer) clearTimeout(room.closeTimer);
  room.closeTimer = null;
  room.clients.set(client.id, client);
  const everyone = Array.from(room.awareness.getStates().keys());
  client.send("sync", {
    state: toBase64(Y.encodeStateAsUpdate(room.doc)),
    stateVector: toBase64(Y.encodeStateVector(room.doc)),
    awareness: everyone.length ? toBase64(encodeAwarenessUpdate(room.awareness, everyone)) : "",
  });
  return async () => {
    room.clients.delete(client.id);
    // La presencia de esa pestaña desaparece para los demás.
    if (room.awareness.getStates().has(client.awarenessId)) {
      removeAwarenessStates(room.awareness, [client.awarenessId], "disconnect");
      broadcast(room, "awareness", { update: toBase64(encodeAwarenessUpdate(room.awareness, [client.awarenessId])) }, client.id);
    }
    if (room.clients.size === 0) {
      await persist(db, room);
      room.closeTimer = setTimeout(() => closeRoom(room), IDLE_CLOSE_MS);
    }
  };
}

function closeRoom(room: Room) {
  if (room.clients.size > 0 || room.closed) return;
  room.closed = true;
  if (room.persistTimer) clearTimeout(room.persistTimer);
  room.doc.destroy();
  room.awareness.destroy();
  rooms.delete(room.pageId);
}

function broadcast(room: Room, event: string, data: unknown, exceptClientId?: string) {
  for (const c of room.clients.values()) if (c.id !== exceptClientId) c.send(event, data);
}

/** Aplica una actualización de un cliente y la reenvía al resto. */
export async function applyClientUpdate(db: Db, pageId: string, clientId: string, userId: string, update: Uint8Array): Promise<void> {
  const room = getRoom(db, pageId);
  await room.ready;
  Y.applyUpdate(room.doc, update, clientId);
  room.lastEditor = userId;
  broadcast(room, "update", { update: toBase64(update), from: clientId }, clientId);
  schedulePersist(db, room);
}

export async function applyClientAwareness(db: Db, pageId: string, clientId: string, update: Uint8Array): Promise<void> {
  const room = getRoom(db, pageId);
  await room.ready;
  applyAwarenessUpdate(room.awareness, update, clientId);
  broadcast(room, "awareness", { update: toBase64(update) }, clientId);
}

/** Avisa a los editores abiertos de un cambio de metadatos (p. ej. el título). */
export function broadcastMeta(pageId: string, meta: Record<string, unknown>, exceptClientId?: string) {
  const room = rooms.get(pageId);
  if (room) broadcast(room, "meta", meta, exceptClientId);
}

/**
 * El contenido cambió por una vía ajena a la colaboración (restaurar versión, edición pública, API):
 * se descarta el estado colaborativo y se pide a los editores abiertos que recarguen.
 */
export async function invalidateRoom(db: Db, pageId: string): Promise<void> {
  const room = rooms.get(pageId);
  if (room) {
    room.closed = true;
    if (room.persistTimer) clearTimeout(room.persistTimer);
    broadcast(room, "reset", {});
    rooms.delete(pageId);
    room.doc.destroy();
  }
  await db.delete(pageYdocs).where(eq(pageYdocs.pageId, pageId));
}

export const activeRoomCount = () => rooms.size;
export const roomClients = (pageId: string) => rooms.get(pageId)?.clients.size ?? 0;
export const roomText = (pageId: string) => {
  const room = rooms.get(pageId);
  return room ? extractText(yDocToProsemirrorJSON(room.doc, FIELD)) : null;
};
