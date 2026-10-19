import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { HttpError, type SessionUser } from "./auth";
import type { Db } from "./db";
import { favorites, pagePermissions, pages, workspaceMembers } from "./schema";

export type Role = "owner" | "admin" | "member" | "guest";
export type Level = "none" | "view" | "comment" | "edit" | "full";
export type Scope = "private" | "workspace";

const RANK: Record<Level, number> = { none: 0, view: 1, comment: 2, edit: 3, full: 4 };
export const atLeast = (a: Level, b: Level) => RANK[a] >= RANK[b];
const maxLevel = (...ls: Level[]): Level => ls.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), "none" as Level);
export const LEVELS: Level[] = ["view", "comment", "edit", "full"];
export const ROLES: Role[] = ["owner", "admin", "member", "guest"];

/** Nivel que concede el alcance «workspace» a cada rol del espacio. */
const scopeLevel = (role: Role | null): Level => (role === "owner" || role === "admin" ? "full" : role === "member" ? "edit" : "none");

export async function memberRole(db: Db, userId: string, workspaceId: string): Promise<Role | null> {
  const [m] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)));
  return (m?.role as Role | undefined) ?? null;
}

export type ChainPage = {
  id: string;
  parentId: string | null;
  workspaceId: string | null;
  creatorId: string | null;
  scope: Scope | null;
  collectionId: string | null;
  deletedAt: Date | null;
  locked: boolean;
};

/** La página y sus ancestros, de la propia página hacia la raíz. */
export async function pageChain(db: Db, pageId: string): Promise<ChainPage[]> {
  const res = (await db.execute(sql`
    WITH RECURSIVE chain AS (
      SELECT id, parent_id, workspace_id, creator_id, scope, collection_id, deleted_at, locked, 0 AS depth FROM pages WHERE id = ${pageId}
      UNION ALL
      SELECT p.id, p.parent_id, p.workspace_id, p.creator_id, p.scope, p.collection_id, p.deleted_at, p.locked, c.depth + 1
      FROM pages p JOIN chain c ON p.id = c.parent_id
    )
    SELECT * FROM chain ORDER BY depth
  `)) as unknown as { rows: Record<string, unknown>[] };
  return res.rows.map((r) => ({
    id: r.id as string,
    parentId: (r.parent_id as string | null) ?? null,
    workspaceId: (r.workspace_id as string | null) ?? null,
    creatorId: (r.creator_id as string | null) ?? null,
    scope: ((r.scope as string | null) ?? null) as Scope | null,
    collectionId: (r.collection_id as string | null) ?? null,
    deletedAt: r.deleted_at ? new Date(r.deleted_at as string) : null,
    locked: r.locked === true,
  }));
}

/** `level` ya descuenta el bloqueo de la página; `canUnlock` indica si la persona podría editarla sin él. */
export type PageAccess = { level: Level; role: Role | null; workspaceId: string; page: ChainPage; scope: Scope; locked: boolean; canUnlock: boolean };

/** Nivel efectivo de un usuario sobre una página. `null` si la página no existe. */
export async function pageAccess(db: Db, userId: string, pageId: string): Promise<PageAccess | null> {
  const chain = await pageChain(db, pageId);
  if (chain.length === 0) return null;
  const page = chain[0];
  const workspaceId = page.workspaceId ?? chain.find((c) => c.workspaceId)?.workspaceId ?? null;
  if (!workspaceId) return null;
  const role = await memberRole(db, userId, workspaceId);
  const perms = await db
    .select({ pageId: pagePermissions.pageId, level: pagePermissions.level })
    .from(pagePermissions)
    .where(and(eq(pagePermissions.userId, userId), inArray(pagePermissions.pageId, chain.map((c) => c.id))));
  const effScope = (chain.find((c) => c.scope)?.scope ?? "private") as Scope;
  const explicit = maxLevel(
    ...chain.map((c): Level => (c.creatorId === userId ? "full" : "none")),
    ...perms.map((p) => p.level as Level),
  );
  // Sin pertenecer al espacio (ni como invitado) no hay acceso por alcance; los permisos explícitos solo valen a miembros/invitados.
  const level = role ? maxLevel(explicit, effScope === "workspace" ? scopeLevel(role) : "none") : "none";
  // Una página bloqueada se comporta como de solo comentarios para todos hasta que alguien con permiso de edición la desbloquea.
  const locked = page.locked && atLeast(level, "edit");
  return { level: locked ? "comment" : level, role, workspaceId, page, scope: effScope, locked: page.locked, canUnlock: atLeast(level, "edit") };
}

/** Exige un nivel mínimo. 404 si no hay ningún acceso (no revela la existencia), 403 si el nivel es insuficiente. */
export async function assertPage(db: Db, user: SessionUser, pageId: string, min: Level): Promise<PageAccess> {
  const a = await pageAccess(db, user.id, pageId);
  if (!a || a.level === "none") throw new HttpError(404, "Página no encontrada");
  if (!atLeast(a.level, min)) throw new HttpError(403, "No tienes permiso para esta acción");
  return a;
}

/** Página anfitriona de una base de datos → su control de acceso. */
export async function assertCollection(db: Db, user: SessionUser, collectionId: string, min: Level): Promise<PageAccess> {
  const res = (await db.execute(sql`SELECT host_page_id FROM collections WHERE id = ${collectionId}`)) as unknown as { rows: { host_page_id: string }[] };
  const host = res.rows[0]?.host_page_id;
  if (!host) throw new HttpError(404, "Base de datos no encontrada");
  return assertPage(db, user, host, min);
}

export async function assertMember(db: Db, user: SessionUser, workspaceId: string, minRole?: Role[]): Promise<Role> {
  const role = await memberRole(db, user.id, workspaceId);
  if (!role) throw new HttpError(404, "Espacio de trabajo no encontrado");
  if (minRole && !minRole.includes(role)) throw new HttpError(403, "No tienes permiso para esta acción");
  return role;
}

export type VisiblePage = {
  id: string;
  parentId: string | null;
  title: string;
  icon: string | null;
  position: number;
  kind: string;
  isFavorite: boolean;
  level: Level;
  scope: Scope;
  creatorId: string | null;
};

/** Páginas del espacio que el usuario puede ver (sin registros de bases de datos ni papelera). */
export async function visiblePages(db: Db, userId: string, workspaceId: string): Promise<VisiblePage[]> {
  const role = await memberRole(db, userId, workspaceId);
  if (!role) return [];
  const rows = await db
    .select({
      id: pages.id,
      parentId: pages.parentId,
      title: pages.title,
      icon: pages.icon,
      position: pages.position,
      kind: pages.kind,
      creatorId: pages.creatorId,
      scope: pages.scope,
    })
    .from(pages)
    .where(and(eq(pages.workspaceId, workspaceId), isNull(pages.deletedAt), isNull(pages.collectionId)));
  const perms = new Map(
    (await db.select({ pageId: pagePermissions.pageId, level: pagePermissions.level }).from(pagePermissions).where(eq(pagePermissions.userId, userId))).map((p) => [p.pageId, p.level as Level]),
  );
  const favs = new Set((await db.select({ id: favorites.pageId }).from(favorites).where(eq(favorites.userId, userId))).map((f) => f.id));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const memo = new Map<string, { explicit: Level; scope: Scope }>();
  const resolve = (id: string): { explicit: Level; scope: Scope } => {
    const hit = memo.get(id);
    if (hit) return hit;
    const p = byId.get(id)!;
    const parent = p.parentId ? byId.get(p.parentId) : undefined;
    const up = parent ? resolve(parent.id) : { explicit: "none" as Level, scope: "private" as Scope };
    const out = {
      explicit: maxLevel(up.explicit, p.creatorId === userId ? "full" : "none", perms.get(id) ?? "none"),
      scope: ((p.scope as Scope | null) ?? up.scope) as Scope,
    };
    memo.set(id, out);
    return out;
  };
  const out: VisiblePage[] = [];
  for (const p of rows) {
    const r = resolve(p.id);
    const level = maxLevel(r.explicit, r.scope === "workspace" ? scopeLevel(role) : "none");
    if (level === "none") continue;
    out.push({ id: p.id, parentId: p.parentId, title: p.title, icon: p.icon, position: p.position, kind: p.kind, isFavorite: favs.has(p.id), level, scope: r.scope, creatorId: p.creatorId });
  }
  return out;
}
