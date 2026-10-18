import { and, asc, desc, eq, inArray, isNotNull, isNull, max, sql } from "drizzle-orm";
import type { Db } from "./db";
import { pages, type PageRow } from "./schema";

export type PageSummary = Pick<
  PageRow,
  "id" | "parentId" | "title" | "icon" | "position" | "isFavorite"
>;

const summaryCols = {
  id: pages.id,
  parentId: pages.parentId,
  title: pages.title,
  icon: pages.icon,
  position: pages.position,
  isFavorite: pages.isFavorite,
};

/** Texto plano de un documento TipTap/ProseMirror (bloques separados por espacio). */
export function extractText(node: unknown): string {
  const parts: string[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const { text, content } = n as { text?: unknown; content?: unknown };
    if (typeof text === "string") parts.push(text);
    if (Array.isArray(content)) content.forEach(walk);
    if (Array.isArray(content) && !("text" in (n as object))) parts.push(" ");
  };
  walk(node);
  return parts.join("").replace(/\s+/g, " ").trim();
}

export class NotFoundError extends Error {}
export class InvalidMoveError extends Error {}

/** Ids de la página y todos sus descendientes. */
async function subtreeIds(db: Db, rootId: string): Promise<string[]> {
  const res = (await db.execute(sql`
    WITH RECURSIVE tree AS (
      SELECT id FROM pages WHERE id = ${rootId}
      UNION ALL
      SELECT p.id FROM pages p JOIN tree t ON p.parent_id = t.id
    )
    SELECT id FROM tree
  `)) as unknown as { rows: { id: string }[] };
  return res.rows.map((r) => r.id);
}

export async function listPages(db: Db): Promise<PageSummary[]> {
  return db
    .select(summaryCols)
    .from(pages)
    .where(isNull(pages.deletedAt))
    .orderBy(asc(pages.position), asc(pages.createdAt));
}

export async function getPage(db: Db, id: string): Promise<PageRow> {
  const [row] = await db.select().from(pages).where(eq(pages.id, id));
  if (!row) throw new NotFoundError("Página no encontrada");
  return row;
}

export async function createPage(
  db: Db,
  input: { parentId?: string | null; title?: string; icon?: string | null },
): Promise<PageRow> {
  const parentId = input.parentId ?? null;
  if (parentId) {
    const parent = await getPage(db, parentId);
    if (parent.deletedAt) throw new NotFoundError("La página padre está en la papelera");
  }
  const [{ last }] = await db
    .select({ last: max(pages.position) })
    .from(pages)
    .where(and(parentId ? eq(pages.parentId, parentId) : isNull(pages.parentId), isNull(pages.deletedAt)));
  const [row] = await db
    .insert(pages)
    .values({
      parentId,
      title: input.title ?? "",
      icon: input.icon ?? null,
      position: (last ?? 0) + 1,
    })
    .returning();
  return row;
}

export async function updatePage(
  db: Db,
  id: string,
  patch: Partial<Pick<PageRow, "title" | "icon" | "isFavorite" | "parentId" | "position" | "content">>,
): Promise<PageRow> {
  if (patch.parentId !== undefined && patch.parentId !== null) {
    if (patch.parentId === id || (await subtreeIds(db, id)).includes(patch.parentId)) {
      throw new InvalidMoveError("Una página no puede moverse dentro de sí misma");
    }
  }
  const [row] = await db
    .update(pages)
    .set({
      ...patch,
      ...(patch.content !== undefined ? { contentText: extractText(patch.content) } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(pages.id, id), isNull(pages.deletedAt)))
    .returning();
  if (!row) throw new NotFoundError("Página no encontrada");
  return row;
}

/** Envía la página y sus descendientes a la papelera con el mismo sello temporal. */
async function trashPageTx(db: Db, id: string): Promise<void> {
  const page = await getPage(db, id);
  if (page.deletedAt) return;
  const ids = await subtreeIds(db, id);
  await db
    .update(pages)
    .set({ deletedAt: new Date(), isFavorite: false })
    .where(and(inArray(pages.id, ids), isNull(pages.deletedAt)));
}

async function restorePageTx(db: Db, id: string): Promise<PageRow> {
  const page = await getPage(db, id);
  if (!page.deletedAt) return page;
  const stamp = page.deletedAt;
  const ids = await subtreeIds(db, id);
  await db
    .update(pages)
    .set({ deletedAt: null })
    .where(and(inArray(pages.id, ids), eq(pages.deletedAt, stamp)));
  // Si el padre sigue en la papelera, la página restaurada pasa a la raíz.
  if (page.parentId) {
    const parent = await getPage(db, page.parentId);
    if (parent.deletedAt) await db.update(pages).set({ parentId: null }).where(eq(pages.id, id));
  }
  return getPage(db, id);
}

export async function deletePagePermanently(db: Db, id: string): Promise<void> {
  const page = await getPage(db, id);
  if (!page.deletedAt) throw new InvalidMoveError("Solo se pueden eliminar definitivamente páginas de la papelera");
  await db.delete(pages).where(eq(pages.id, id));
}

/** Raíces de la papelera: páginas eliminadas cuyo padre no fue eliminado en el mismo momento. */
export async function listTrash(db: Db): Promise<PageSummary[]> {
  const rows = await db
    .select({ ...summaryCols, deletedAt: pages.deletedAt })
    .from(pages)
    .where(isNotNull(pages.deletedAt))
    .orderBy(desc(pages.deletedAt));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return rows
    .filter((r) => {
      const parent = r.parentId ? byId.get(r.parentId) : undefined;
      return !parent || parent.deletedAt?.getTime() !== r.deletedAt?.getTime();
    })
    .map((r) => ({
      id: r.id,
      parentId: r.parentId,
      title: r.title,
      icon: r.icon,
      position: r.position,
      isFavorite: r.isFavorite,
    }));
}

/** Mueve una página a `parentId` en la posición `index` entre sus hermanas (0 = primera). */
async function movePageTx(
  db: Db,
  id: string,
  target: { parentId: string | null; index: number },
): Promise<PageRow> {
  const siblings = (
    await db
      .select({ id: pages.id, position: pages.position })
      .from(pages)
      .where(and(target.parentId ? eq(pages.parentId, target.parentId) : isNull(pages.parentId), isNull(pages.deletedAt)))
      .orderBy(asc(pages.position), asc(pages.createdAt))
  ).filter((p) => p.id !== id);
  const i = Math.max(0, Math.min(target.index, siblings.length));
  let position: number;
  if (siblings.length === 0) position = 1;
  else if (i === 0) position = siblings[0].position - 1;
  else if (i >= siblings.length) position = siblings[siblings.length - 1].position + 1;
  else position = (siblings[i - 1].position + siblings[i].position) / 2;
  return updatePage(db, id, { parentId: target.parentId, position });
}

/** Copia la página y todo su subárbol activo; la copia queda justo después de la original. */
async function duplicatePageTx(db: Db, id: string): Promise<PageRow> {
  const root = await getPage(db, id);
  if (root.deletedAt) throw new NotFoundError("Página no encontrada");
  const ids = await subtreeIds(db, id);
  const rows = await db.select().from(pages).where(and(inArray(pages.id, ids), isNull(pages.deletedAt)));
  const byParent = new Map<string | null, PageRow[]>();
  for (const r of rows) byParent.set(r.parentId, [...(byParent.get(r.parentId) ?? []), r]);

  const copy = async (src: PageRow, parentId: string | null, position: number): Promise<PageRow> => {
    const [row] = await db
      .insert(pages)
      .values({ parentId, title: src.title, icon: src.icon, content: src.content, contentText: src.contentText, position })
      .returning();
    for (const child of (byParent.get(src.id) ?? []).sort((a, b) => a.position - b.position)) {
      await copy(child, row.id, child.position);
    }
    return row;
  };

  const next = (
    await db
      .select({ position: pages.position })
      .from(pages)
      .where(and(root.parentId ? eq(pages.parentId, root.parentId) : isNull(pages.parentId), isNull(pages.deletedAt)))
  )
    .map((p) => p.position)
    .filter((p) => p > root.position)
    .sort((a, b) => a - b)[0];
  return copy(root, root.parentId, next === undefined ? root.position + 1 : (root.position + next) / 2);
}

export type SearchResult = PageSummary & { snippet: string; path: string[] };

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export async function searchPages(
  db: Db,
  query: string,
  opts: { titlesOnly?: boolean; limit?: number } = {},
): Promise<SearchResult[]> {
  const q = fold(query.trim());
  const rows = await db
    .select({ ...summaryCols, contentText: pages.contentText })
    .from(pages)
    .where(isNull(pages.deletedAt))
    .orderBy(desc(pages.updatedAt));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const pathOf = (r: (typeof rows)[number]) => {
    const out: string[] = [];
    const seen = new Set<string>();
    let cur = r.parentId ? byId.get(r.parentId) : undefined;
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      out.unshift(cur.title);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return out;
  };
  const results: (SearchResult & { rank: number })[] = [];
  for (const r of rows) {
    const inTitle = q === "" ? true : fold(r.title).includes(q);
    const at = q === "" || opts.titlesOnly ? -1 : fold(r.contentText).indexOf(q);
    if (!inTitle && at < 0) continue;
    let snippet = "";
    if (at >= 0) {
      const start = Math.max(0, at - 30);
      snippet = (start > 0 ? "…" : "") + r.contentText.slice(start, at + q.length + 60);
    }
    results.push({
      id: r.id, parentId: r.parentId, title: r.title, icon: r.icon, position: r.position, isFavorite: r.isFavorite,
      snippet, path: pathOf(r), rank: inTitle ? 0 : 1,
    });
  }
  return results.sort((a, b) => a.rank - b.rank).slice(0, opts.limit ?? 20).map((x) => ({ id: x.id, parentId: x.parentId, title: x.title, icon: x.icon, position: x.position, isFavorite: x.isFavorite, snippet: x.snippet, path: x.path }));
}

// Operaciones de varios pasos: se ejecutan en una transacción para no dejar árboles a medias.
export const trashPage = (db: Db, id: string) => db.transaction((tx) => trashPageTx(tx, id));
export const restorePage = (db: Db, id: string) => db.transaction((tx) => restorePageTx(tx, id));
export const movePage = (db: Db, id: string, target: { parentId: string | null; index: number }) =>
  db.transaction((tx) => movePageTx(tx, id, target));
export const duplicatePage = (db: Db, id: string) => db.transaction((tx) => duplicatePageTx(tx, id));
