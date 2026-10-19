import { and, asc, desc, eq, sql } from "drizzle-orm";
import { HttpError, newToken, type SessionUser } from "./auth";
import { assertPage, atLeast, memberRole, pageChain, type Level, type Scope } from "./authz";
import type { Db } from "./db";
import { favorites, pagePermissions, pageShares, pageVersions, pages, users, workspaceMembers } from "./schema";
import { createInvitation, normalizeEmail } from "./workspaces-service";

export type PersonAccess = {
  userId: string;
  name: string;
  email: string;
  avatarColor: string;
  level: Level;
  /** creator: autor de la página · explicit: permiso concedido · inherited: concedido en una página superior */
  source: "creator" | "explicit" | "inherited";
  isSelf: boolean;
};

export type SharingInfo = {
  scope: Scope;
  /** true si la página define su propio alcance (no lo hereda). */
  scopeIsOwn: boolean;
  yourLevel: Level;
  people: PersonAccess[];
  publicLink: { token: string; level: "view" | "comment" | "edit" } | null;
};

export async function sharingInfo(db: Db, actor: SessionUser, pageId: string): Promise<SharingInfo> {
  const access = await assertPage(db, actor, pageId, "view");
  const chain = await pageChain(db, pageId);
  const ids = chain.map((c) => c.id);
  const perms = (
    await db
      .select({ userId: pagePermissions.userId, pageId: pagePermissions.pageId, level: pagePermissions.level, name: users.name, email: users.email, avatarColor: users.avatarColor })
      .from(pagePermissions)
      .innerJoin(users, eq(users.id, pagePermissions.userId))
      .where(sql`${pagePermissions.pageId} IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`)
  ).sort((a, b) => ids.indexOf(a.pageId) - ids.indexOf(b.pageId));
  const people = new Map<string, PersonAccess>();
  const creatorIds = [...new Set(chain.map((c) => c.creatorId).filter((x): x is string => !!x))];
  for (const cid of creatorIds) {
    const [u] = await db.select().from(users).where(eq(users.id, cid));
    if (u) people.set(u.id, { userId: u.id, name: u.name, email: u.email, avatarColor: u.avatarColor, level: "full", source: "creator", isSelf: u.id === actor.id });
  }
  for (const p of perms) {
    const cur = people.get(p.userId);
    if (cur?.level === "full") continue;
    people.set(p.userId, { userId: p.userId, name: p.name, email: p.email, avatarColor: p.avatarColor, level: p.level as Level, source: p.pageId === pageId ? "explicit" : "inherited", isSelf: p.userId === actor.id });
  }
  const [share] = await db.select().from(pageShares).where(eq(pageShares.pageId, pageId));
  const list = [...people.values()].sort((a, b) => Number(b.isSelf) - Number(a.isSelf));
  // Quien no administra la página solo ve su propia fila.
  const visible = atLeast(access.level, "full") ? list : list.filter((p) => p.isSelf);
  return {
    scope: access.scope,
    scopeIsOwn: !!chain[0].scope,
    yourLevel: access.level,
    people: visible,
    publicLink: share && atLeast(access.level, "full") ? { token: share.token, level: share.level as "view" | "comment" | "edit" } : null,
  };
}

/** Comparte una página con una persona por correo. Si no tiene cuenta, devuelve un enlace de invitación. */
export async function sharePage(
  db: Db,
  actor: SessionUser,
  pageId: string,
  input: { email: string; level: Exclude<Level, "none"> },
): Promise<{ status: "shared"; userId: string } | { status: "invited"; token: string }> {
  const access = await assertPage(db, actor, pageId, "full");
  if (access.role === "guest") throw new HttpError(403, "Los invitados no pueden compartir páginas");
  const email = normalizeEmail(input.email);
  const [target] = await db.select().from(users).where(eq(users.email, email));
  if (!target) {
    const inv = await createInvitation(db, actor, access.workspaceId, { email, role: "guest", pageId, pageLevel: input.level });
    return { status: "invited", token: inv.token };
  }
  await db.transaction(async (tx) => {
    if (!(await memberRole(tx, target.id, access.workspaceId))) await tx.insert(workspaceMembers).values({ workspaceId: access.workspaceId, userId: target.id, role: "guest" });
    await tx
      .insert(pagePermissions)
      .values({ pageId, userId: target.id, level: input.level })
      .onConflictDoUpdate({ target: [pagePermissions.pageId, pagePermissions.userId], set: { level: input.level } });
  });
  return { status: "shared", userId: target.id };
}

export async function setPermission(db: Db, actor: SessionUser, pageId: string, userId: string, level: Exclude<Level, "none"> | null): Promise<void> {
  const access = await assertPage(db, actor, pageId, "full");
  const chain = await pageChain(db, pageId);
  if (chain.some((c) => c.creatorId === userId)) throw new HttpError(409, "No se puede cambiar el acceso del autor de la página");
  if (level === null) await db.delete(pagePermissions).where(and(eq(pagePermissions.pageId, pageId), eq(pagePermissions.userId, userId)));
  else {
    if (!(await memberRole(db, userId, access.workspaceId))) throw new HttpError(404, "La persona no pertenece al espacio");
    await db.insert(pagePermissions).values({ pageId, userId, level }).onConflictDoUpdate({ target: [pagePermissions.pageId, pagePermissions.userId], set: { level } });
  }
}

export async function setScope(db: Db, actor: SessionUser, pageId: string, scope: Scope | null): Promise<void> {
  const access = await assertPage(db, actor, pageId, "full");
  if (access.role === "guest") throw new HttpError(403, "Los invitados no pueden cambiar el acceso general");
  await db.update(pages).set({ scope, updatedAt: new Date() }).where(eq(pages.id, pageId));
}

// ── Enlace público ───────────────────────────────────────────────────

export async function publishPage(db: Db, actor: SessionUser, pageId: string, level: "view" | "comment" | "edit"): Promise<{ token: string; level: string }> {
  const access = await assertPage(db, actor, pageId, "full");
  if (access.role === "guest") throw new HttpError(403, "Los invitados no pueden publicar páginas");
  const [cur] = await db.select().from(pageShares).where(eq(pageShares.pageId, pageId));
  if (cur) {
    await db.update(pageShares).set({ level }).where(eq(pageShares.pageId, pageId));
    return { token: cur.token, level };
  }
  const token = newToken();
  await db.insert(pageShares).values({ pageId, token, level });
  return { token, level };
}

export async function unpublishPage(db: Db, actor: SessionUser, pageId: string): Promise<void> {
  await assertPage(db, actor, pageId, "full");
  await db.delete(pageShares).where(eq(pageShares.pageId, pageId));
}

/** Resuelve un enlace público: devuelve la página raíz compartida y el nivel concedido. */
export async function resolveShare(db: Db, token: string): Promise<{ pageId: string; level: "view" | "comment" | "edit" } | null> {
  const [s] = await db.select().from(pageShares).where(eq(pageShares.token, token));
  return s ? { pageId: s.pageId, level: s.level as "view" | "comment" | "edit" } : null;
}

/** ¿`pageId` es la página compartida o un descendiente suyo? (los enlaces públicos cubren el subárbol). */
export async function isWithinShared(db: Db, pageId: string, rootId: string): Promise<boolean> {
  return (await pageChain(db, pageId)).some((c) => c.id === rootId);
}

// ── Favoritos por usuario ────────────────────────────────────────────

export async function setFavorite(db: Db, user: SessionUser, pageId: string, value: boolean): Promise<void> {
  await assertPage(db, user, pageId, "view");
  if (value) await db.insert(favorites).values({ userId: user.id, pageId }).onConflictDoNothing();
  else await db.delete(favorites).where(and(eq(favorites.userId, user.id), eq(favorites.pageId, pageId)));
}

// ── Historial de versiones ───────────────────────────────────────────

const MAX_VERSIONS = 50;
const versionInterval = () => Number(process.env.NODARA_VERSION_INTERVAL_MS ?? 5 * 60 * 1000);

/** Guarda una versión si pasó el intervalo desde la última (o no hay ninguna). */
export async function maybeSnapshot(db: Db, pageId: string, userId: string | null, force = false): Promise<boolean> {
  const [page] = await db.select().from(pages).where(eq(pages.id, pageId));
  if (!page) return false;
  const [last] = await db.select().from(pageVersions).where(eq(pageVersions.pageId, pageId)).orderBy(desc(pageVersions.createdAt)).limit(1);
  if (!force && last && Date.now() - last.createdAt.getTime() < versionInterval()) return false;
  if (last && JSON.stringify(last.content) === JSON.stringify(page.content) && last.title === page.title) return false;
  await db.insert(pageVersions).values({ pageId, title: page.title, content: page.content as object, createdBy: userId });
  const all = await db.select({ id: pageVersions.id }).from(pageVersions).where(eq(pageVersions.pageId, pageId)).orderBy(desc(pageVersions.createdAt));
  for (const old of all.slice(MAX_VERSIONS)) await db.delete(pageVersions).where(eq(pageVersions.id, old.id));
  return true;
}

export async function listVersions(db: Db, actor: SessionUser, pageId: string) {
  await assertPage(db, actor, pageId, "view");
  return db
    .select({ id: pageVersions.id, title: pageVersions.title, createdAt: pageVersions.createdAt, authorName: users.name })
    .from(pageVersions)
    .leftJoin(users, eq(users.id, pageVersions.createdBy))
    .where(eq(pageVersions.pageId, pageId))
    .orderBy(desc(pageVersions.createdAt));
}

export async function getVersion(db: Db, actor: SessionUser, pageId: string, versionId: string) {
  await assertPage(db, actor, pageId, "view");
  const [v] = await db.select().from(pageVersions).where(and(eq(pageVersions.id, versionId), eq(pageVersions.pageId, pageId)));
  if (!v) throw new HttpError(404, "Versión no encontrada");
  return v;
}

export async function restoreVersion(db: Db, actor: SessionUser, pageId: string, versionId: string): Promise<void> {
  await assertPage(db, actor, pageId, "edit");
  const v = await getVersion(db, actor, pageId, versionId);
  await maybeSnapshot(db, pageId, actor.id, true); // el estado actual no se pierde
  const { extractText } = await import("./pages-service");
  await db.update(pages).set({ title: v.title, content: v.content as object, contentText: extractText(v.content), updatedAt: new Date() }).where(eq(pages.id, pageId));
}

export { asc };
