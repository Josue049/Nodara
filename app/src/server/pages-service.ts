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

export class NotFoundError extends Error {}
export class InvalidMoveError extends Error {}

/** Ids de la página y todos sus descendientes. */
async function subtreeIds(db: Db, rootId: string): Promise<string[]> {
  const res = await db.execute<{ id: string }>(sql`
    WITH RECURSIVE tree AS (
      SELECT id FROM pages WHERE id = ${rootId}
      UNION ALL
      SELECT p.id FROM pages p JOIN tree t ON p.parent_id = t.id
    )
    SELECT id FROM tree
  `);
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
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(pages.id, id), isNull(pages.deletedAt)))
    .returning();
  if (!row) throw new NotFoundError("Página no encontrada");
  return row;
}

/** Envía la página y sus descendientes a la papelera con el mismo sello temporal. */
export async function trashPage(db: Db, id: string): Promise<void> {
  const page = await getPage(db, id);
  if (page.deletedAt) return;
  const ids = await subtreeIds(db, id);
  await db
    .update(pages)
    .set({ deletedAt: new Date(), isFavorite: false })
    .where(and(inArray(pages.id, ids), isNull(pages.deletedAt)));
}

export async function restorePage(db: Db, id: string): Promise<PageRow> {
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
