import { and, asc, eq, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { docToHtml, docToMarkdown, markdownToDoc, type DocNode } from "@/lib/export/markdown";
import { inferColumnType, parseBool, parseCsv, parseNumber, toCsv } from "@/lib/export/csv";
import { formatDate } from "@/lib/collections/format";
import type { DateValue, PropertyDef, SelectOption } from "@/lib/collections/types";
import { addProperty, addRecord, createDatabase, getBundle, queryCollection } from "./collections-service";
import type { Db } from "./db";
import { createPage, getPage, updatePage } from "./pages-service";
import { collectionProperties, collectionViews, collections, pages } from "./schema";

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_CSV_ROWS = 5000;
export const MAX_CSV_COLUMNS = 60;

export class ImportError extends Error {}

const safeFileName = (s: string) => (s || "Sin título").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 100);

// ── Exportar páginas ────────────────────────────────────────────────

export type ExportFormat = "md" | "html" | "json";

export async function exportPage(db: Db, pageId: string, format: ExportFormat): Promise<{ body: string; contentType: string; filename: string }> {
  const page = await getPage(db, pageId);
  const title = page.title || "Sin título";
  const base = safeFileName(title);
  if (format === "md") return { body: docToMarkdown(page.content, title), contentType: "text/markdown; charset=utf-8", filename: `${base}.md` };
  if (format === "html") return { body: docToHtml(page.content, title), contentType: "text/html; charset=utf-8", filename: `${base}.html` };
  return {
    body: JSON.stringify({ format: "nodara-page", version: 1, title, icon: page.icon, content: page.content, exportedAt: new Date().toISOString() }, null, 2),
    contentType: "application/json; charset=utf-8",
    filename: `${base}.json`,
  };
}

// ── Exportar bases de datos (CSV) ───────────────────────────────────

function cellText(p: PropertyDef, v: unknown, refs: Record<string, { title: string }>): string {
  if (v === null || v === undefined) return "";
  switch (p.type) {
    case "select":
    case "status":
      return (p.config.options ?? []).find((o) => o.id === v)?.name ?? "";
    case "multi_select":
      return Array.isArray(v) ? v.map((id) => (p.config.options ?? []).find((o) => o.id === id)?.name ?? "").filter(Boolean).join(", ") : "";
    case "date":
    case "created_time":
    case "last_edited_time":
      return typeof v === "object" && v && "start" in v ? formatDate(v as DateValue) : String(v);
    case "checkbox":
      return v === true ? "Sí" : "No";
    case "relation":
      return Array.isArray(v) ? v.map((id) => refs[String(id)]?.title ?? "").filter(Boolean).join(", ") : "";
    case "files":
      return Array.isArray(v) ? v.map((f: { name: string }) => f.name).join(", ") : "";
    default:
      return Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v);
  }
}

export async function exportCollectionCsv(db: Db, collectionId: string): Promise<{ body: string; filename: string }> {
  const res = await queryCollection(db, collectionId, { config: {} });
  const props = res.bundle.properties;
  const [host] = await db.select({ title: pages.title }).from(pages).where(eq(pages.id, res.bundle.collection.hostPageId));
  const header = ["Nombre", ...props.map((p) => p.name)];
  const rows = res.rows.map((r) => [r.title, ...props.map((p) => cellText(p, r.values[p.id], res.refs ?? {}))]);
  return { body: toCsv([header, ...rows]), filename: `${safeFileName(res.bundle.collection.title || host?.title || "Base de datos")}.csv` };
}

// ── Copia de seguridad del espacio de trabajo (JSON) ────────────────

export async function exportWorkspaceBackup(db: Db, workspaceId: string) {
  const rows = await db.select().from(pages).where(and(eq(pages.workspaceId, workspaceId), isNull(pages.deletedAt))).orderBy(asc(pages.position));
  const ids = new Set(rows.map((r) => r.id));
  const cols = (await db.select().from(collections)).filter((c) => ids.has(c.hostPageId));
  const colIds = new Set(cols.map((c) => c.id));
  const props = (await db.select().from(collectionProperties)).filter((p) => colIds.has(p.collectionId));
  const views = (await db.select().from(collectionViews)).filter((v) => colIds.has(v.collectionId));
  return {
    format: "nodara-workspace-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    workspaceId,
    pages: rows.map((r) => ({ id: r.id, parentId: r.parentId, title: r.title, icon: r.icon, kind: r.kind, collectionId: r.collectionId, properties: r.properties, content: r.content, position: r.position, createdAt: r.createdAt })),
    collections: cols,
    properties: props,
    views,
  };
}

// ── Importar ────────────────────────────────────────────────────────

type Target = { workspaceId: string; parentId?: string | null; creatorId: string };

async function newPageWithContent(db: Db, t: Target, title: string, doc: unknown, icon?: string | null) {
  const page = await createPage(db, { parentId: t.parentId ?? null, workspaceId: t.workspaceId, creatorId: t.creatorId, title: title.slice(0, 500), icon: icon ?? null });
  return updatePage(db, page.id, { content: doc as never });
}

export async function importMarkdown(db: Db, t: Target, text: string, fallbackTitle: string) {
  const { title, doc } = markdownToDoc(text);
  return newPageWithContent(db, t, title ?? fallbackTitle, doc);
}

export async function importJson(db: Db, t: Target, text: string, fallbackTitle: string) {
  let data: { format?: string; title?: string; icon?: string | null; content?: DocNode };
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportError("El archivo no es un JSON válido");
  }
  if (data.format !== "nodara-page" || data.content?.type !== "doc") throw new ImportError("El JSON no es una exportación de página de Nodara");
  return newPageWithContent(db, t, data.title || fallbackTitle, data.content, typeof data.icon === "string" ? data.icon.slice(0, 16) : null);
}

const SELECT_COLORS = ["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"] as const;

/** Crea una base de datos a partir de un CSV: la primera columna es el nombre; el resto de columnas se tipan según sus valores. */
export async function importCsv(db: Db, t: Target, text: string, fallbackTitle: string) {
  const table = parseCsv(text);
  if (table.length < 1) throw new ImportError("El CSV está vacío");
  const header = table[0].map((h) => h.trim());
  if (header.length > MAX_CSV_COLUMNS) throw new ImportError(`El CSV tiene demasiadas columnas (máximo ${MAX_CSV_COLUMNS})`);
  const body = table.slice(1);
  if (body.length > MAX_CSV_ROWS) throw new ImportError(`El CSV tiene demasiadas filas (máximo ${MAX_CSV_ROWS})`);

  const created = await createDatabase(db, { parentId: t.parentId ?? null, workspaceId: t.workspaceId, creatorId: t.creatorId, title: fallbackTitle });
  const cid = created.collection.id;
  const colIndexByProp = new Map<string, number>();
  const props: PropertyDef[] = [];
  const used = new Set<string>(["nombre"]);
  for (let c = 1; c < header.length; c++) {
    let name = header[c] || `Columna ${c + 1}`;
    while (used.has(name.toLowerCase())) name += " (2)";
    used.add(name.toLowerCase());
    const values = body.map((r) => r[c] ?? "");
    const type = inferColumnType(values);
    const options: SelectOption[] | undefined =
      type === "select" ? [...new Set(values.map((v) => v.trim()).filter(Boolean))].map((n, i) => ({ id: randomUUID(), name: n, color: SELECT_COLORS[i % SELECT_COLORS.length] })) : undefined;
    const p = await addProperty(db, cid, { name, type, ...(options ? { config: { options } } : {}) });
    props.push(p);
    colIndexByProp.set(p.id, c);
  }
  for (const row of body) {
    const properties: Record<string, unknown> = {};
    for (const p of props) {
      const raw = (row[colIndexByProp.get(p.id)!] ?? "").trim();
      if (!raw) continue;
      if (p.type === "number") properties[p.id] = parseNumber(raw);
      else if (p.type === "checkbox") properties[p.id] = parseBool(raw);
      else if (p.type === "date") properties[p.id] = { start: raw };
      else if (p.type === "select") properties[p.id] = (p.config.options ?? []).find((o) => o.name === raw)?.id ?? null;
      else properties[p.id] = raw.slice(0, 5000);
    }
    await addRecord(db, cid, { title: (row[0] ?? "").slice(0, 500), properties, creatorId: t.creatorId });
  }
  return { ...(await getBundle(db, cid)), page: created.page, rows: body.length };
}

