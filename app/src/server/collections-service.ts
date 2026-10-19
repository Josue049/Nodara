import { and, asc, eq, inArray, isNull, max } from "drizzle-orm";
import { runQuery, normalizeStored, type CollectionData, type StoredRecord, type World } from "@/lib/collections/query";
import { validateFormula } from "@/lib/collections/formula";
import {
  COMPUTED_TYPES,
  PROPERTY_TYPES,
  TITLE_ID,
  VIEW_TYPES,
  type CollectionBundle,
  type CollectionDef,
  type PropertyConfig,
  type PropertyDef,
  type PropertyType,
  type PropValue,
  type QueryResult,
  type SelectOption,
  type TemplateDef,
  type ViewConfig,
  type ViewDef,
  type ViewType,
} from "@/lib/collections/types";
import type { Db } from "./db";
import { collectionProperties, collectionTemplates, collections, collectionViews, pages, type PageRow } from "./schema";

export class CollectionError extends Error {}
export class CollectionNotFound extends Error {}

type CollectionRow = typeof collections.$inferSelect;
type PropRow = typeof collectionProperties.$inferSelect;
type ViewRow = typeof collectionViews.$inferSelect;
type TemplateRow = typeof collectionTemplates.$inferSelect;

const toCollection = (r: CollectionRow): CollectionDef => ({ id: r.id, hostPageId: r.hostPageId, title: r.title, icon: r.icon, isInline: r.isInline });
const toProp = (r: PropRow): PropertyDef => ({ id: r.id, collectionId: r.collectionId, name: r.name, type: r.type as PropertyType, config: r.config as PropertyConfig, position: r.position });
const toView = (r: ViewRow): ViewDef => ({ id: r.id, collectionId: r.collectionId, name: r.name, type: r.type as ViewType, config: r.config as ViewConfig, position: r.position });
const toTemplate = (r: TemplateRow): TemplateDef => ({ id: r.id, collectionId: r.collectionId, name: r.name, title: r.title, properties: r.properties as Record<string, PropValue>, content: r.content });

const DEFAULT_STATUS: SelectOption[] = [
  { id: "todo", name: "Sin empezar", color: "gray", group: "todo" },
  { id: "doing", name: "En curso", color: "blue", group: "in_progress" },
  { id: "done", name: "Listo", color: "green", group: "done" },
];

const newId = () => crypto.randomUUID();

// ── Colecciones ──────────────────────────────────────────────────────

export async function getBundle(db: Db, collectionId: string): Promise<CollectionBundle> {
  const [c] = await db.select().from(collections).where(eq(collections.id, collectionId));
  if (!c) throw new CollectionNotFound("Base de datos no encontrada");
  const [props, views] = await Promise.all([
    db.select().from(collectionProperties).where(eq(collectionProperties.collectionId, collectionId)).orderBy(asc(collectionProperties.position)),
    db.select().from(collectionViews).where(eq(collectionViews.collectionId, collectionId)).orderBy(asc(collectionViews.position)),
  ]);
  return { collection: toCollection(c), properties: props.map(toProp), views: views.map(toView) };
}

/** Base de datos de página completa alojada en `pageId`, si la hay. */
export async function bundleForPage(db: Db, pageId: string): Promise<CollectionBundle | null> {
  const [c] = await db.select().from(collections).where(and(eq(collections.hostPageId, pageId), eq(collections.isInline, false)));
  return c ? getBundle(db, c.id) : null;
}

/**
 * Crea una base de datos. Sin `hostPageId` crea una página de tipo «database» (página completa);
 * con `hostPageId` crea una base integrada en esa página.
 */
export async function createDatabase(
  db: Db,
  input: { parentId?: string | null; title?: string; hostPageId?: string; workspaceId?: string | null; creatorId?: string | null },
): Promise<CollectionBundle & { page: PageRow }> {
  return db.transaction(async (tx) => {
    let host: PageRow;
    if (input.hostPageId) {
      const [h] = await tx.select().from(pages).where(and(eq(pages.id, input.hostPageId), isNull(pages.deletedAt)));
      if (!h) throw new CollectionNotFound("Página anfitriona no encontrada");
      host = h;
    } else {
      const [{ last }] = await tx
        .select({ last: max(pages.position) })
        .from(pages)
        .where(and(input.parentId ? eq(pages.parentId, input.parentId) : isNull(pages.parentId), isNull(pages.deletedAt), isNull(pages.collectionId)));
      let workspaceId = input.workspaceId ?? null;
      if (input.parentId) {
        const [parent] = await tx.select().from(pages).where(eq(pages.id, input.parentId));
        if (!parent || parent.deletedAt) throw new CollectionNotFound("Página padre no encontrada");
        workspaceId = parent.workspaceId;
      }
      [host] = await tx
        .insert(pages)
        .values({
          parentId: input.parentId ?? null,
          title: input.title ?? "",
          kind: "database",
          position: (last ?? 0) + 1,
          workspaceId,
          creatorId: input.creatorId ?? null,
          scope: input.parentId ? null : workspaceId ? "private" : null,
        })
        .returning();
    }
    const [c] = await tx
      .insert(collections)
      .values({ hostPageId: host.id, title: input.hostPageId ? (input.title ?? "") : "", isInline: !!input.hostPageId })
      .returning();
    await tx.insert(collectionViews).values({ collectionId: c.id, name: "Tabla", type: "table", config: {}, position: 1 });
    return { ...(await getBundle(tx, c.id)), page: host };
  });
}

export async function updateCollection(db: Db, id: string, patch: { title?: string; icon?: string | null }): Promise<CollectionDef> {
  const [c] = await db.update(collections).set({ ...patch, updatedAt: new Date() }).where(eq(collections.id, id)).returning();
  if (!c) throw new CollectionNotFound("Base de datos no encontrada");
  return toCollection(c);
}

/** Bases de datos existentes (para elegir destino de una relación). */
export async function listCollections(db: Db): Promise<{ id: string; title: string; icon: string | null; isInline: boolean; workspaceId: string | null }[]> {
  const rows = await db
    .select({ id: collections.id, title: collections.title, icon: collections.icon, isInline: collections.isInline, hostTitle: pages.title, hostIcon: pages.icon, workspaceId: pages.workspaceId })
    .from(collections)
    .innerJoin(pages, eq(pages.id, collections.hostPageId))
    .where(isNull(pages.deletedAt));
  return rows.map((r) => ({ id: r.id, title: (r.isInline ? r.title : r.hostTitle) || "", icon: r.isInline ? r.icon : r.hostIcon, isInline: r.isInline, workspaceId: r.workspaceId }));
}

// ── Propiedades ──────────────────────────────────────────────────────

function defaultConfig(type: PropertyType, config: PropertyConfig = {}): PropertyConfig {
  if (type === "status" && !config.options) return { ...config, options: DEFAULT_STATUS.map((o) => ({ ...o })) };
  if ((type === "select" || type === "multi_select") && !config.options) return { ...config, options: [] };
  if (type === "number" && !config.format) return { ...config, format: "number" };
  return config;
}

async function loadProps(db: Db, collectionId: string): Promise<PropertyDef[]> {
  return (await db.select().from(collectionProperties).where(eq(collectionProperties.collectionId, collectionId)).orderBy(asc(collectionProperties.position))).map(toProp);
}

async function assertFormula(db: Db, collectionId: string, expression: string | undefined, selfId?: string) {
  if (expression === undefined) return;
  const props = (await loadProps(db, collectionId)).filter((p) => p.id !== selfId);
  const err = validateFormula(expression, ["Nombre", ...props.map((p) => p.name)]);
  if (err) throw new CollectionError(err);
}

export async function addProperty(
  db: Db,
  collectionId: string,
  input: { name: string; type: PropertyType; config?: PropertyConfig; bidirectional?: boolean; position?: number },
): Promise<PropertyDef> {
  if (!PROPERTY_TYPES.includes(input.type)) throw new CollectionError("Tipo de propiedad no válido");
  return db.transaction(async (tx) => {
    const props = await loadProps(tx, collectionId);
    if (props.some((p) => p.name.toLowerCase() === input.name.trim().toLowerCase())) throw new CollectionError("Ya existe una propiedad con ese nombre");
    const config = defaultConfig(input.type, input.config);
    if (input.type === "formula") {
      if (!config.expression) throw new CollectionError("La fórmula necesita una expresión");
      await assertFormula(tx, collectionId, config.expression);
    }
    if (input.type === "relation") {
      if (!config.relationCollectionId) throw new CollectionError("La relación necesita una base de datos de destino");
      await getBundle(tx, config.relationCollectionId);
    }
    if (input.type === "rollup") {
      const rel = props.find((p) => p.id === config.rollupRelationId && p.type === "relation");
      if (!rel || !config.rollupTargetId || !config.rollupFn) throw new CollectionError("El rollup necesita relación, propiedad y función");
    }
    const position = input.position ?? Math.max(0, ...props.map((p) => p.position)) + 1;
    const [row] = await tx.insert(collectionProperties).values({ collectionId, name: input.name.trim(), type: input.type, config, position }).returning();
    const prop = toProp(row);
    if (input.type === "relation" && input.bidirectional && config.relationCollectionId) {
      const [host] = await tx.select().from(collections).where(eq(collections.id, collectionId));
      const [hostPage] = await tx.select().from(pages).where(eq(pages.id, host.hostPageId));
      const targetProps = await loadProps(tx, config.relationCollectionId);
      let recName = (host.title || hostPage?.title || "Relación").trim() || "Relación";
      while (targetProps.some((p) => p.name === recName)) recName += " (relación)";
      const [rec] = await tx
        .insert(collectionProperties)
        .values({
          collectionId: config.relationCollectionId,
          name: recName,
          type: "relation",
          config: { relationCollectionId: collectionId, reciprocalPropertyId: row.id },
          position: Math.max(0, ...targetProps.map((p) => p.position)) + 1,
        })
        .returning();
      const [updated] = await tx
        .update(collectionProperties)
        .set({ config: { ...config, reciprocalPropertyId: rec.id } })
        .where(eq(collectionProperties.id, row.id))
        .returning();
      return toProp(updated);
    }
    return prop;
  });
}

export async function updateProperty(
  db: Db,
  id: string,
  patch: { name?: string; config?: PropertyConfig; position?: number },
): Promise<PropertyDef> {
  const [cur] = await db.select().from(collectionProperties).where(eq(collectionProperties.id, id));
  if (!cur) throw new CollectionNotFound("Propiedad no encontrada");
  if (patch.name !== undefined) {
    const siblings = await loadProps(db, cur.collectionId);
    if (siblings.some((p) => p.id !== id && p.name.toLowerCase() === patch.name!.trim().toLowerCase())) throw new CollectionError("Ya existe una propiedad con ese nombre");
  }
  if (patch.config?.expression !== undefined) await assertFormula(db, cur.collectionId, patch.config.expression, id);
  const config = patch.config ? { ...(cur.config as PropertyConfig), ...patch.config } : undefined;
  const [row] = await db
    .update(collectionProperties)
    .set({ ...(patch.name !== undefined ? { name: patch.name.trim() } : {}), ...(config ? { config } : {}), ...(patch.position !== undefined ? { position: patch.position } : {}) })
    .where(eq(collectionProperties.id, id))
    .returning();
  return toProp(row);
}

export async function deleteProperty(db: Db, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [cur] = await tx.select().from(collectionProperties).where(eq(collectionProperties.id, id));
    if (!cur) throw new CollectionNotFound("Propiedad no encontrada");
    const cfg = cur.config as PropertyConfig;
    await tx.delete(collectionProperties).where(eq(collectionProperties.id, id));
    if (cur.type === "relation" && cfg.reciprocalPropertyId) await tx.delete(collectionProperties).where(eq(collectionProperties.id, cfg.reciprocalPropertyId));
    // Los rollups que dependían de una relación eliminada dejan de tener sentido.
    const dependents = (await tx.select().from(collectionProperties).where(eq(collectionProperties.collectionId, cur.collectionId))).filter(
      (p) => p.type === "rollup" && (p.config as PropertyConfig).rollupRelationId === id,
    );
    if (dependents.length) await tx.delete(collectionProperties).where(inArray(collectionProperties.id, dependents.map((d) => d.id)));
  });
}

/** Añade una opción (select / multi_select / status) y devuelve la propiedad actualizada. */
export async function addOption(db: Db, propertyId: string, option: { name: string; color?: SelectOption["color"]; group?: SelectOption["group"] }): Promise<{ property: PropertyDef; option: SelectOption }> {
  const [cur] = await db.select().from(collectionProperties).where(eq(collectionProperties.id, propertyId));
  if (!cur || !["select", "multi_select", "status"].includes(cur.type)) throw new CollectionError("La propiedad no admite opciones");
  const cfg = cur.config as PropertyConfig;
  const existing = (cfg.options ?? []).find((o) => o.name.toLowerCase() === option.name.trim().toLowerCase());
  if (existing) return { property: toProp(cur), option: existing };
  const colors = ["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"] as const;
  const opt: SelectOption = {
    id: newId(),
    name: option.name.trim(),
    color: option.color ?? colors[(cfg.options ?? []).length % colors.length],
    ...(cur.type === "status" ? { group: option.group ?? "todo" } : {}),
  };
  const [row] = await db.update(collectionProperties).set({ config: { ...cfg, options: [...(cfg.options ?? []), opt] } }).where(eq(collectionProperties.id, propertyId)).returning();
  return { property: toProp(row), option: opt };
}

// ── Registros ────────────────────────────────────────────────────────

const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;

function coerce(p: PropertyDef, raw: unknown): PropValue {
  if (raw === null || raw === undefined) return p.type === "checkbox" ? false : p.type === "multi_select" || p.type === "relation" || p.type === "files" ? [] : null;
  switch (p.type) {
    case "text":
    case "url":
    case "email":
    case "phone":
      if (typeof raw !== "string") throw new CollectionError(`«${p.name}» espera texto`);
      return raw.slice(0, 5000);
    case "number":
      if (typeof raw !== "number" || !Number.isFinite(raw)) throw new CollectionError(`«${p.name}» espera un número`);
      return raw;
    case "checkbox":
      return raw === true;
    case "select":
    case "status": {
      if (typeof raw !== "string" || !(p.config.options ?? []).some((o) => o.id === raw)) throw new CollectionError(`Opción no válida para «${p.name}»`);
      return raw;
    }
    case "multi_select": {
      if (!Array.isArray(raw) || raw.some((x) => typeof x !== "string" || !(p.config.options ?? []).some((o) => o.id === x))) throw new CollectionError(`Opciones no válidas para «${p.name}»`);
      return [...new Set(raw as string[])];
    }
    case "date": {
      const v = raw as { start?: unknown; end?: unknown; time?: unknown };
      if (typeof v !== "object" || typeof v.start !== "string" || !ISO_DAY.test(v.start) || Number.isNaN(Date.parse(v.start))) throw new CollectionError(`Fecha no válida en «${p.name}»`);
      if (v.end != null && (typeof v.end !== "string" || !ISO_DAY.test(v.end) || v.end < v.start)) throw new CollectionError(`La fecha final de «${p.name}» no es válida`);
      return { start: v.start, ...(v.end ? { end: v.end as string } : {}), ...(v.time ? { time: true } : {}) };
    }
    case "files": {
      if (!Array.isArray(raw)) throw new CollectionError(`«${p.name}» espera una lista de archivos`);
      return (raw as { name?: unknown; url?: unknown }[]).map((f) => {
        if (typeof f?.name !== "string" || typeof f?.url !== "string" || !/^(\/api\/files\/|https?:\/\/)/.test(f.url)) throw new CollectionError(`Archivo no válido en «${p.name}»`);
        return { name: f.name.slice(0, 200), url: f.url };
      });
    }
    case "relation":
      if (!Array.isArray(raw) || raw.some((x) => typeof x !== "string")) throw new CollectionError(`«${p.name}» espera una lista de páginas`);
      return [...new Set(raw as string[])];
    default:
      throw new CollectionError(`«${p.name}» se calcula automáticamente y no se puede editar`);
  }
}

async function nextPosition(db: Db, hostPageId: string): Promise<number> {
  const [{ last }] = await db.select({ last: max(pages.position) }).from(pages).where(and(eq(pages.parentId, hostPageId), isNull(pages.deletedAt)));
  return (last ?? 0) + 1;
}

export async function addRecord(
  db: Db,
  collectionId: string,
  input: { title?: string; properties?: Record<string, unknown>; templateId?: string; creatorId?: string | null },
): Promise<PageRow> {
  return db.transaction(async (tx) => {
    const bundle = await getBundle(tx, collectionId);
    let title = input.title ?? "";
    let values: Record<string, unknown> = {};
    let content: unknown = [];
    if (input.templateId) {
      const [t] = await tx.select().from(collectionTemplates).where(and(eq(collectionTemplates.id, input.templateId), eq(collectionTemplates.collectionId, collectionId)));
      if (!t) throw new CollectionNotFound("Plantilla no encontrada");
      title = input.title ?? t.title;
      values = { ...(t.properties as Record<string, unknown>) };
      content = t.content && (t.content as { type?: string }).type === "doc" ? t.content : [];
    }
    Object.assign(values, input.properties ?? {});
    const clean: Record<string, PropValue> = {};
    for (const [pid, raw] of Object.entries(values)) {
      const p = bundle.properties.find((x) => x.id === pid);
      if (!p) continue;
      clean[pid] = coerce(p, raw);
    }
    const [row] = await tx
      .insert(pages)
      .values({
        parentId: bundle.collection.hostPageId,
        collectionId,
        title,
        content: content as object,
        properties: clean,
        workspaceId: (await tx.select({ w: pages.workspaceId }).from(pages).where(eq(pages.id, bundle.collection.hostPageId)))[0]?.w ?? null,
        creatorId: input.creatorId ?? null,
        position: await nextPosition(tx, bundle.collection.hostPageId),
      })
      .returning();
    await syncRelations(tx, bundle.properties, row.id, {}, clean);
    return row;
  });
}

/** Mantiene las relaciones bidireccionales: refleja altas y bajas en la propiedad recíproca. */
async function syncRelations(db: Db, props: PropertyDef[], recordId: string, before: Record<string, unknown>, after: Record<string, PropValue>) {
  for (const p of props) {
    if (p.type !== "relation" || !p.config.reciprocalPropertyId || !(p.id in after)) continue;
    const prev = new Set(Array.isArray(before[p.id]) ? (before[p.id] as string[]) : []);
    const next = new Set((after[p.id] as string[]) ?? []);
    const added = [...next].filter((x) => !prev.has(x));
    const removed = [...prev].filter((x) => !next.has(x));
    const touch = async (targetId: string, add: boolean) => {
      const [t] = await db.select().from(pages).where(eq(pages.id, targetId));
      if (!t || t.collectionId !== p.config.relationCollectionId) return;
      const props2 = { ...(t.properties as Record<string, unknown>) };
      const list = new Set(Array.isArray(props2[p.config.reciprocalPropertyId!]) ? (props2[p.config.reciprocalPropertyId!] as string[]) : []);
      if (add) list.add(recordId);
      else list.delete(recordId);
      props2[p.config.reciprocalPropertyId!] = [...list];
      await db.update(pages).set({ properties: props2, updatedAt: new Date() }).where(eq(pages.id, targetId));
    };
    for (const id of added) await touch(id, true);
    for (const id of removed) await touch(id, false);
  }
}

export async function updateRecord(
  db: Db,
  recordId: string,
  patch: { title?: string; icon?: string | null; properties?: Record<string, unknown> },
): Promise<PageRow> {
  return db.transaction(async (tx) => {
    const [rec] = await tx.select().from(pages).where(and(eq(pages.id, recordId), isNull(pages.deletedAt)));
    if (!rec || !rec.collectionId) throw new CollectionNotFound("Registro no encontrado");
    const props = await loadProps(tx, rec.collectionId);
    const before = rec.properties as Record<string, unknown>;
    const clean: Record<string, PropValue> = {};
    for (const [pid, raw] of Object.entries(patch.properties ?? {})) {
      const p = props.find((x) => x.id === pid);
      if (!p) throw new CollectionError("Propiedad desconocida");
      clean[pid] = coerce(p, raw);
    }
    const [row] = await tx
      .update(pages)
      .set({
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.icon !== undefined ? { icon: patch.icon } : {}),
        properties: { ...before, ...clean },
        updatedAt: new Date(),
      })
      .where(eq(pages.id, recordId))
      .returning();
    await syncRelations(tx, props, recordId, before, clean);
    return row;
  });
}

// ── Consulta ─────────────────────────────────────────────────────────

async function loadData(db: Db, collectionId: string): Promise<CollectionData> {
  const [props, rows] = await Promise.all([
    loadProps(db, collectionId),
    db
      .select({ id: pages.id, title: pages.title, icon: pages.icon, createdAt: pages.createdAt, updatedAt: pages.updatedAt, properties: pages.properties, position: pages.position })
      .from(pages)
      .where(and(eq(pages.collectionId, collectionId), isNull(pages.deletedAt)))
      .orderBy(asc(pages.position), asc(pages.createdAt)),
  ]);
  const records: StoredRecord[] = rows.map((r) => ({ id: r.id, title: r.title, icon: r.icon, createdAt: r.createdAt, updatedAt: r.updatedAt, properties: r.properties as Record<string, unknown> }));
  return { props, records };
}

/** Carga la colección y, transitivamente, las que alcanzan sus relaciones. */
export async function loadWorld(db: Db, collectionId: string): Promise<World> {
  const loaded = new Map<string, CollectionData>();
  const queue = [collectionId];
  while (queue.length) {
    const id = queue.pop()!;
    if (loaded.has(id)) continue;
    const data = await loadData(db, id);
    loaded.set(id, data);
    for (const p of data.props) if (p.type === "relation" && p.config.relationCollectionId && !loaded.has(p.config.relationCollectionId)) queue.push(p.config.relationCollectionId);
  }
  return (id) => loaded.get(id);
}

export async function queryCollection(
  db: Db,
  collectionId: string,
  opts: { viewId?: string; config?: ViewConfig; search?: string } = {},
): Promise<QueryResult & { bundle: CollectionBundle }> {
  const bundle = await getBundle(db, collectionId);
  const view = opts.viewId ? bundle.views.find((v) => v.id === opts.viewId) : bundle.views[0];
  if (opts.viewId && !view) throw new CollectionNotFound("Vista no encontrada");
  const world = await loadWorld(db, collectionId);
  const result = runQuery(collectionId, world, opts.config ?? view?.config ?? {}, { search: opts.search });
  const refs: NonNullable<QueryResult["refs"]> = {};
  for (const p of bundle.properties) {
    if (p.type !== "relation" || !p.config.relationCollectionId) continue;
    const target = world(p.config.relationCollectionId);
    for (const row of result.rows) {
      for (const id of (row.values[p.id] as string[] | null) ?? []) {
        const rec = target?.records.find((r) => r.id === id);
        if (rec) refs[id] = { title: rec.title, icon: rec.icon };
      }
    }
  }
  return { ...result, refs, bundle };
}

// ── Vistas ───────────────────────────────────────────────────────────

export async function createView(db: Db, collectionId: string, input: { name?: string; type: ViewType; config?: ViewConfig }): Promise<ViewDef> {
  if (!VIEW_TYPES.includes(input.type)) throw new CollectionError("Tipo de vista no válido");
  const bundle = await getBundle(db, collectionId);
  const labels: Record<ViewType, string> = { table: "Tabla", board: "Tablero", list: "Lista", gallery: "Galería", calendar: "Calendario", timeline: "Cronograma" };
  let config = input.config ?? {};
  // Valores por defecto razonables según la capa.
  if (input.type === "board" && !config.group) {
    const g = bundle.properties.find((p) => p.type === "status") ?? bundle.properties.find((p) => p.type === "select");
    if (g) config = { ...config, group: { propertyId: g.id } };
  }
  if ((input.type === "calendar" || input.type === "timeline") && !config.dateProperty) {
    const d = bundle.properties.find((p) => p.type === "date");
    if (d) config = { ...config, dateProperty: d.id };
  }
  const [row] = await db
    .insert(collectionViews)
    .values({ collectionId, name: input.name ?? labels[input.type], type: input.type, config, position: Math.max(0, ...bundle.views.map((v) => v.position)) + 1 })
    .returning();
  return toView(row);
}

export async function updateView(db: Db, id: string, patch: { name?: string; type?: ViewType; config?: ViewConfig }): Promise<ViewDef> {
  if (patch.type && !VIEW_TYPES.includes(patch.type)) throw new CollectionError("Tipo de vista no válido");
  const [row] = await db
    .update(collectionViews)
    .set({ ...(patch.name !== undefined ? { name: patch.name } : {}), ...(patch.type ? { type: patch.type } : {}), ...(patch.config ? { config: patch.config } : {}) })
    .where(eq(collectionViews.id, id))
    .returning();
  if (!row) throw new CollectionNotFound("Vista no encontrada");
  return toView(row);
}

export async function deleteView(db: Db, id: string): Promise<void> {
  const [v] = await db.select().from(collectionViews).where(eq(collectionViews.id, id));
  if (!v) throw new CollectionNotFound("Vista no encontrada");
  const siblings = await db.select({ id: collectionViews.id }).from(collectionViews).where(eq(collectionViews.collectionId, v.collectionId));
  if (siblings.length <= 1) throw new CollectionError("Una base de datos necesita al menos una vista");
  await db.delete(collectionViews).where(eq(collectionViews.id, id));
}

export async function duplicateView(db: Db, id: string): Promise<ViewDef> {
  const [v] = await db.select().from(collectionViews).where(eq(collectionViews.id, id));
  if (!v) throw new CollectionNotFound("Vista no encontrada");
  return createView(db, v.collectionId, { name: `${v.name} (copia)`, type: v.type as ViewType, config: v.config as ViewConfig });
}

// ── Plantillas ───────────────────────────────────────────────────────

export async function listTemplates(db: Db, collectionId: string): Promise<TemplateDef[]> {
  return (await db.select().from(collectionTemplates).where(eq(collectionTemplates.collectionId, collectionId)).orderBy(asc(collectionTemplates.position))).map(toTemplate);
}

export async function createTemplate(
  db: Db,
  collectionId: string,
  input: { name: string; title?: string; properties?: Record<string, unknown>; content?: unknown },
): Promise<TemplateDef> {
  const bundle = await getBundle(db, collectionId);
  const clean: Record<string, PropValue> = {};
  for (const [pid, raw] of Object.entries(input.properties ?? {})) {
    const p = bundle.properties.find((x) => x.id === pid && !COMPUTED_TYPES.includes(x.type));
    if (p) clean[pid] = coerce(p, raw);
  }
  const existing = await listTemplates(db, collectionId);
  const [row] = await db
    .insert(collectionTemplates)
    .values({ collectionId, name: input.name, title: input.title ?? "", properties: clean, content: (input.content as object) ?? {}, position: existing.length + 1 })
    .returning();
  return toTemplate(row);
}

export async function updateTemplate(db: Db, id: string, patch: { name?: string; title?: string; properties?: Record<string, unknown>; content?: unknown }): Promise<TemplateDef> {
  const [cur] = await db.select().from(collectionTemplates).where(eq(collectionTemplates.id, id));
  if (!cur) throw new CollectionNotFound("Plantilla no encontrada");
  const bundle = await getBundle(db, cur.collectionId);
  let properties = cur.properties as Record<string, PropValue>;
  if (patch.properties) {
    properties = {};
    for (const [pid, raw] of Object.entries(patch.properties)) {
      const p = bundle.properties.find((x) => x.id === pid && !COMPUTED_TYPES.includes(x.type));
      if (p) properties[pid] = coerce(p, raw);
    }
  }
  const [row] = await db
    .update(collectionTemplates)
    .set({ ...(patch.name !== undefined ? { name: patch.name } : {}), ...(patch.title !== undefined ? { title: patch.title } : {}), properties, ...(patch.content !== undefined ? { content: patch.content as object } : {}) })
    .where(eq(collectionTemplates.id, id))
    .returning();
  return toTemplate(row);
}

export async function deleteTemplate(db: Db, id: string): Promise<void> {
  await db.delete(collectionTemplates).where(eq(collectionTemplates.id, id));
}

// ── Clonado (al duplicar páginas que contienen bases de datos) ───────

/**
 * Tras copiar un árbol de páginas (`idMap`: id original → id de la copia), duplica las bases de datos
 * cuyo anfitrión se copió: propiedades, vistas, plantillas, y reescribe valores de registros
 * (ids de propiedad, relaciones internas) y los bloques integrados del contenido.
 */
export async function cloneCollectionsForCopy(db: Db, idMap: Map<string, string>): Promise<void> {
  const oldHostIds = [...idMap.keys()];
  const cols = oldHostIds.length ? await db.select().from(collections).where(inArray(collections.hostPageId, oldHostIds)) : [];
  if (!cols.length) return;
  const colMap = new Map<string, string>();
  const propMap = new Map<string, string>();

  for (const c of cols) {
    const [nc] = await db.insert(collections).values({ hostPageId: idMap.get(c.hostPageId)!, title: c.title, icon: c.icon, isInline: c.isInline }).returning();
    colMap.set(c.id, nc.id);
  }
  for (const c of cols) {
    const props = await db.select().from(collectionProperties).where(eq(collectionProperties.collectionId, c.id));
    for (const p of props) {
      const [np] = await db.insert(collectionProperties).values({ collectionId: colMap.get(c.id)!, name: p.name, type: p.type, config: p.config as object, position: p.position }).returning();
      propMap.set(p.id, np.id);
    }
  }
  // Reapunta la configuración de propiedades y vistas a los ids nuevos.
  for (const newPropId of propMap.values()) {
    const [row] = await db.select().from(collectionProperties).where(eq(collectionProperties.id, newPropId));
    const cfg = { ...(row.config as PropertyConfig) };
    if (cfg.relationCollectionId && colMap.has(cfg.relationCollectionId)) cfg.relationCollectionId = colMap.get(cfg.relationCollectionId)!;
    if (cfg.reciprocalPropertyId) cfg.reciprocalPropertyId = propMap.get(cfg.reciprocalPropertyId) ?? null;
    if (cfg.rollupRelationId) cfg.rollupRelationId = propMap.get(cfg.rollupRelationId) ?? cfg.rollupRelationId;
    if (cfg.rollupTargetId && propMap.has(cfg.rollupTargetId)) cfg.rollupTargetId = propMap.get(cfg.rollupTargetId)!;
    await db.update(collectionProperties).set({ config: cfg }).where(eq(collectionProperties.id, newPropId));
  }
  const remapView = (cfg: ViewConfig): ViewConfig => {
    const s = JSON.stringify(cfg);
    let out = s;
    for (const [o, n] of propMap) out = out.split(o).join(n);
    return JSON.parse(out) as ViewConfig;
  };
  for (const c of cols) {
    const views = await db.select().from(collectionViews).where(eq(collectionViews.collectionId, c.id));
    for (const v of views) await db.insert(collectionViews).values({ collectionId: colMap.get(c.id)!, name: v.name, type: v.type, config: remapView(v.config as ViewConfig), position: v.position });
    const tpls = await db.select().from(collectionTemplates).where(eq(collectionTemplates.collectionId, c.id));
    for (const t of tpls) {
      let props = JSON.stringify(t.properties);
      for (const [o, n] of propMap) props = props.split(o).join(n);
      await db.insert(collectionTemplates).values({ collectionId: colMap.get(c.id)!, name: t.name, title: t.title, properties: JSON.parse(props), content: t.content as object, position: t.position });
    }
  }
  // Registros copiados: pertenecen a la colección nueva y sus valores usan los ids nuevos.
  for (const [oldCol, newCol] of colMap) {
    const copiedRecords = await db
      .select()
      .from(pages)
      .where(and(eq(pages.collectionId, oldCol), inArray(pages.id, [...idMap.values()])));
    for (const r of copiedRecords) {
      const old = r.properties as Record<string, unknown>;
      const fresh: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(old)) {
        const nk = propMap.get(k) ?? k;
        fresh[nk] = Array.isArray(v) ? v.map((x) => (typeof x === "string" ? (idMap.get(x) ?? x) : x)) : v;
      }
      await db.update(pages).set({ collectionId: newCol, properties: fresh }).where(eq(pages.id, r.id));
    }
  }
  // Bloques integrados: reescribe collectionId en el contenido de las páginas copiadas.
  for (const newPageId of idMap.values()) {
    const [pg] = await db.select().from(pages).where(eq(pages.id, newPageId));
    if (!pg) continue;
    let s = JSON.stringify(pg.content);
    let changed = false;
    for (const [o, n] of colMap) {
      if (s.includes(o)) {
        s = s.split(o).join(n);
        changed = true;
      }
    }
    if (changed) await db.update(pages).set({ content: JSON.parse(s) }).where(eq(pages.id, newPageId));
  }
}

export { normalizeStored, TITLE_ID };

/** Colección a la que pertenece una propiedad, vista o plantilla (para autorizar por la página anfitriona). */
export async function collectionIdOf(db: Db, kind: "property" | "view" | "template", id: string): Promise<string> {
  const table = kind === "property" ? collectionProperties : kind === "view" ? collectionViews : collectionTemplates;
  const [row] = await db.select({ c: table.collectionId }).from(table).where(eq(table.id, id));
  if (!row) throw new CollectionNotFound("Elemento no encontrado");
  return row.c;
}
