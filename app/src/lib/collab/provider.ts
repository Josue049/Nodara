import { applyAwarenessUpdate, Awareness, encodeAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness";
import * as Y from "yjs";

export type CollabStatus = "connecting" | "connected" | "offline";
export type SaveStatus = "idle" | "saving" | "saved" | "error";
export type CollabUser = { id: string; name: string; color: string };

export const u8ToB64 = (u: Uint8Array) => {
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
export const b64ToU8 = (b: string) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));

type Opts = { user: CollabUser; onReset?: () => void; onMeta?: (meta: Record<string, unknown>) => void };

/**
 * Proveedor Yjs sobre Server‑Sent Events (recibir) + POST (enviar).
 * - Al (re)conectar el servidor envía su estado; el cliente le devuelve lo que le falta (ediciones sin conexión).
 * - Las actualizaciones locales se encolan y reintentan hasta confirmarse; mientras tanto el estado es «saving».
 */
export class NodaraProvider {
  readonly doc = new Y.Doc();
  readonly awareness: Awareness;
  readonly cid = crypto.randomUUID();
  status: CollabStatus = "connecting";
  save: SaveStatus = "idle";
  synced = false;
  private es: EventSource | null = null;
  private queue: Uint8Array[] = [];
  private flushing = false;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private awarenessTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingAwarenessIds = new Set<number>();
  private listeners = new Set<() => void>();
  private destroyed = false;
  private lastEvent = Date.now();
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private onOffline = () => this.setStatus("offline");
  private onOnline = () => {
    // Al volver la red la conexión anterior puede haber quedado muerta: se abre una nueva y se reenvía lo pendiente.
    this.reconnect();
    void this.flush();
  };

  constructor(
    readonly pageId: string,
    private opts: Opts,
  ) {
    this.awareness = new Awareness(this.doc);
    this.awareness.setLocalStateField("user", opts.user);
    this.doc.on("update", (update: Uint8Array, origin: unknown) => {
      if (origin === "remote" || this.destroyed) return;
      this.queue.push(update);
      this.setSave("saving");
      void this.flush();
    });
    this.awareness.on("update", ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
      if (origin === "remote" || this.destroyed) return;
      for (const id of [...added, ...updated, ...removed]) this.pendingAwarenessIds.add(id);
      this.scheduleAwareness();
    });
    this.awareness.on("change", () => this.emit()); // presencia: quién entra, sale o mueve el cursor
    if (typeof window !== "undefined") {
      window.addEventListener("offline", this.onOffline);
      window.addEventListener("online", this.onOnline);
      this.watchdog = setInterval(() => {
        // El servidor envía «ping» cada 15 s: sin noticias en 45 s la conexión se da por perdida.
        if (this.status === "connected" && Date.now() - this.lastEvent > 45_000) this.reconnect();
      }, 10_000);
    }
    this.connect();
  }

  private reconnect() {
    if (this.destroyed) return;
    this.es?.close();
    this.connect();
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    this.listeners.forEach((l) => l());
  }
  private setStatus(s: CollabStatus) {
    if (this.status !== s) {
      this.status = s;
      this.emit();
    }
  }
  private setSave(s: SaveStatus) {
    if (this.save !== s) {
      this.save = s;
      this.emit();
    }
  }

  private url(path: string) {
    return `/api/collab/${this.pageId}/${path}`;
  }

  private connect() {
    if (this.destroyed) return;
    const es = new EventSource(`${this.url("stream")}?cid=${this.cid}&aid=${this.doc.clientID}`);
    this.es = es;
    this.lastEvent = Date.now();
    es.addEventListener("ping", () => (this.lastEvent = Date.now()));
    es.addEventListener("sync", (e) => {
      this.lastEvent = Date.now();
      const d = JSON.parse((e as MessageEvent).data) as { state: string; stateVector: string; awareness: string };
      Y.applyUpdate(this.doc, b64ToU8(d.state), "remote");
      // Devuelve al servidor lo que solo existe aquí (ediciones hechas sin conexión).
      const missing = Y.encodeStateAsUpdate(this.doc, b64ToU8(d.stateVector));
      if (missing.length > 2) {
        this.queue.push(missing);
        this.setSave("saving");
        void this.flush();
      } else if (this.queue.length === 0 && this.save === "saving") this.setSave("saved");
      if (d.awareness) applyAwarenessUpdate(this.awareness, b64ToU8(d.awareness), "remote");
      this.pendingAwarenessIds.add(this.doc.clientID);
      this.scheduleAwareness();
      this.synced = true;
      this.setStatus("connected");
    });
    es.addEventListener("update", (e) => {
      this.lastEvent = Date.now();
      const d = JSON.parse((e as MessageEvent).data) as { update: string };
      Y.applyUpdate(this.doc, b64ToU8(d.update), "remote");
    });
    es.addEventListener("awareness", (e) => {
      const d = JSON.parse((e as MessageEvent).data) as { update: string };
      applyAwarenessUpdate(this.awareness, b64ToU8(d.update), "remote");
    });
    es.addEventListener("meta", (e) => this.opts.onMeta?.(JSON.parse((e as MessageEvent).data)));
    es.addEventListener("reset", () => this.opts.onReset?.());
    es.onerror = () => {
      if (!this.destroyed) this.setStatus("offline");
    };
    es.onopen = () => {
      if (this.status === "offline") this.setStatus("connecting");
    };
  }

  private async post(path: string, update: Uint8Array): Promise<boolean> {
    try {
      const res = await fetch(this.url(path), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cid: this.cid, update: u8ToB64(update) }) });
      return res.ok;
    } catch {
      // Sin red: se deja constancia para que la interfaz lo muestre.
      if (typeof navigator !== "undefined" && !navigator.onLine) this.setStatus("offline");
      return false;
    }
  }

  private async flush() {
    if (this.flushing || this.destroyed || this.queue.length === 0) return;
    this.flushing = true;
    try {
      while (this.queue.length > 0 && !this.destroyed) {
        const merged = Y.mergeUpdates(this.queue);
        this.queue = [];
        if (!(await this.post("update", merged))) {
          this.queue.unshift(merged);
          this.setSave("error");
          this.retry ??= setTimeout(() => {
            this.retry = null;
            void this.flush();
          }, 1500);
          return;
        }
      }
      this.setSave("saved");
    } finally {
      this.flushing = false;
    }
  }

  private scheduleAwareness() {
    if (this.awarenessTimer) return;
    this.awarenessTimer = setTimeout(() => {
      this.awarenessTimer = null;
      const ids = [...this.pendingAwarenessIds];
      this.pendingAwarenessIds.clear();
      if (ids.length && !this.destroyed) void this.post("awareness", encodeAwarenessUpdate(this.awareness, ids));
    }, 80);
  }

  /** Personas conectadas a la página (sin repetir, sin esta pestaña). */
  others(): { clientId: number; user: CollabUser }[] {
    const out: { clientId: number; user: CollabUser }[] = [];
    this.awareness.getStates().forEach((state, clientId) => {
      const user = (state as { user?: CollabUser }).user;
      if (clientId !== this.doc.clientID && user) out.push({ clientId, user });
    });
    return out;
  }

  /** Fuerza el envío pendiente y espera a que no quede nada en cola. */
  async whenSaved(timeoutMs = 5000): Promise<void> {
    const start = Date.now();
    while ((this.queue.length > 0 || this.flushing) && Date.now() - start < timeoutMs) await new Promise((r) => setTimeout(r, 50));
  }

  destroy() {
    this.destroyed = true;
    if (typeof window !== "undefined") {
      window.removeEventListener("offline", this.onOffline);
      window.removeEventListener("online", this.onOnline);
    }
    if (this.watchdog) clearInterval(this.watchdog);
    this.es?.close();
    if (this.retry) clearTimeout(this.retry);
    if (this.awarenessTimer) clearTimeout(this.awarenessTimer);
    removeAwarenessStates(this.awareness, [this.doc.clientID], "destroy");
    this.awareness.destroy();
    this.doc.destroy();
    this.listeners.clear();
  }
}
