import { and, asc, count, eq, isNull, sql } from "drizzle-orm";
import { hashPassword, HttpError, newToken, sha256, type SessionUser } from "./auth";
import { assertMember, memberRole, ROLES, type Level, type Role } from "./authz";
import type { Db } from "./db";
import { favorites, invitations, pagePermissions, pages, users, workspaceMembers, workspaces } from "./schema";

const AVATAR_COLORS = ["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"];
const INVITE_TTL_MS = 14 * 24 * 3600 * 1000;

export const normalizeEmail = (e: string) => e.trim().toLowerCase();

export type WorkspaceInfo = { id: string; name: string; icon: string | null; role: Role; memberCount: number };

/**
 * Registra un usuario y le crea su espacio de trabajo personal. Si hay páginas anteriores a los usuarios
 * (sin espacio), el primer usuario las adopta: no se pierde ningún dato existente.
 */
export async function registerUser(db: Db, input: { email: string; name: string; password: string }): Promise<{ user: SessionUser; workspace: WorkspaceInfo; adopted: number }> {
  const email = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);
  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (existing) throw new HttpError(409, "Ya existe una cuenta con ese correo");
    const [{ n: before }] = await tx.select({ n: count() }).from(users);
    const color = AVATAR_COLORS[before % AVATAR_COLORS.length];
    const [u] = await tx.insert(users).values({ email, name: input.name.trim(), passwordHash, avatarColor: color }).returning();
    const ws = await createWorkspaceTx(tx, { id: u.id }, `Espacio de ${input.name.trim() || email}`);
    let adopted = 0;
    if (before === 0) adopted = await adoptOrphans(tx, u.id, ws.id);
    return { user: { id: u.id, email: u.email, name: u.name, avatarColor: u.avatarColor }, workspace: ws, adopted };
  });
}

/** Asigna al espacio las páginas sin dueño (datos previos a los usuarios) y migra sus favoritos. */
export async function adoptOrphans(db: Db, userId: string, workspaceId: string): Promise<number> {
  const orphans = await db.select({ id: pages.id, isFavorite: pages.isFavorite, parentId: pages.parentId }).from(pages).where(isNull(pages.workspaceId));
  if (orphans.length === 0) return 0;
  await db.update(pages).set({ workspaceId, creatorId: userId }).where(isNull(pages.workspaceId));
  // Las raíces adoptadas quedan privadas para su creador; las subpáginas heredan.
  await db.update(pages).set({ scope: "private" }).where(and(eq(pages.workspaceId, workspaceId), isNull(pages.parentId), isNull(pages.collectionId)));
  for (const o of orphans.filter((x) => x.isFavorite)) await db.insert(favorites).values({ userId, pageId: o.id }).onConflictDoNothing();
  return orphans.length;
}

async function createWorkspaceTx(db: Db, user: { id: string }, name: string): Promise<WorkspaceInfo> {
  const [ws] = await db.insert(workspaces).values({ name: name.trim(), createdBy: user.id }).returning();
  await db.insert(workspaceMembers).values({ workspaceId: ws.id, userId: user.id, role: "owner" });
  return { id: ws.id, name: ws.name, icon: ws.icon, role: "owner", memberCount: 1 };
}

export const createWorkspace = (db: Db, user: SessionUser, name: string) => db.transaction((tx) => createWorkspaceTx(tx, user, name));

export async function listWorkspaces(db: Db, userId: string): Promise<WorkspaceInfo[]> {
  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      icon: workspaces.icon,
      role: workspaceMembers.role,
      memberCount: sql<number>`(select count(*)::int from workspace_members m where m.workspace_id = ${workspaces.id})`,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, userId))
    .orderBy(asc(workspaces.createdAt));
  return rows.map((r) => ({ ...r, role: r.role as Role }));
}

export async function updateWorkspace(db: Db, user: SessionUser, id: string, patch: { name?: string; icon?: string | null }): Promise<WorkspaceInfo> {
  await assertMember(db, user, id, ["owner", "admin"]);
  await db.update(workspaces).set(patch).where(eq(workspaces.id, id));
  return (await listWorkspaces(db, user.id)).find((w) => w.id === id)!;
}

export async function deleteWorkspace(db: Db, user: SessionUser, id: string): Promise<void> {
  await assertMember(db, user, id, ["owner"]);
  await db.delete(workspaces).where(eq(workspaces.id, id));
}

export type MemberInfo = { userId: string; name: string; email: string; avatarColor: string; role: Role };

export async function listMembers(db: Db, user: SessionUser, workspaceId: string): Promise<MemberInfo[]> {
  const role = await assertMember(db, user, workspaceId);
  const rows = await db
    .select({ userId: users.id, name: users.name, email: users.email, avatarColor: users.avatarColor, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .orderBy(asc(workspaceMembers.createdAt));
  // Los invitados solo ven a los demás miembros por su nombre, no por su correo.
  return rows.map((r) => ({ ...r, role: r.role as Role, email: role === "guest" && r.userId !== user.id ? "" : r.email }));
}

export async function setMemberRole(db: Db, actor: SessionUser, workspaceId: string, userId: string, role: Role): Promise<void> {
  if (!ROLES.includes(role)) throw new HttpError(400, "Rol no válido");
  const actorRole = await assertMember(db, actor, workspaceId, ["owner", "admin"]);
  const target = await memberRole(db, userId, workspaceId);
  if (!target) throw new HttpError(404, "Miembro no encontrado");
  if (actorRole === "admin" && (target === "owner" || role === "owner")) throw new HttpError(403, "Solo un propietario puede gestionar propietarios");
  if (target === "owner" && role !== "owner") await assertAnotherOwner(db, workspaceId, userId);
  await db.update(workspaceMembers).set({ role }).where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)));
}

async function assertAnotherOwner(db: Db, workspaceId: string, exceptUserId: string) {
  const owners = await db.select({ userId: workspaceMembers.userId }).from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.role, "owner")));
  if (!owners.some((o) => o.userId !== exceptUserId)) throw new HttpError(409, "El espacio necesita al menos un propietario");
}

export async function removeMember(db: Db, actor: SessionUser, workspaceId: string, userId: string): Promise<void> {
  const self = actor.id === userId;
  const actorRole = await assertMember(db, actor, workspaceId, self ? undefined : ["owner", "admin"]);
  const target = await memberRole(db, userId, workspaceId);
  if (!target) throw new HttpError(404, "Miembro no encontrado");
  if (!self && actorRole === "admin" && target === "owner") throw new HttpError(403, "Solo un propietario puede quitar a un propietario");
  if (target === "owner") await assertAnotherOwner(db, workspaceId, userId);
  await db.transaction(async (tx) => {
    await tx.delete(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)));
    // Sus permisos explícitos y favoritos en este espacio dejan de tener sentido.
    await tx.execute(sql`DELETE FROM page_permissions WHERE user_id = ${userId} AND page_id IN (SELECT id FROM pages WHERE workspace_id = ${workspaceId})`);
    await tx.execute(sql`DELETE FROM favorites WHERE user_id = ${userId} AND page_id IN (SELECT id FROM pages WHERE workspace_id = ${workspaceId})`);
  });
}

// ── Invitaciones ─────────────────────────────────────────────────────

export async function createInvitation(
  db: Db,
  actor: SessionUser,
  workspaceId: string,
  input: { email: string; role: Role; pageId?: string; pageLevel?: Level },
): Promise<{ token: string; email: string; role: Role }> {
  const actorRole = await assertMember(db, actor, workspaceId, input.pageId ? ["owner", "admin", "member"] : ["owner", "admin"]);
  if (input.role === "owner" && actorRole !== "owner") throw new HttpError(403, "Solo un propietario puede invitar propietarios");
  const email = normalizeEmail(input.email);
  const token = newToken();
  await db.insert(invitations).values({
    workspaceId,
    email,
    role: input.role,
    pageId: input.pageId ?? null,
    pageLevel: input.pageLevel ?? null,
    tokenHash: sha256(token),
    invitedBy: actor.id,
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  });
  return { token, email, role: input.role };
}

export async function getInvitation(db: Db, token: string) {
  const [inv] = await db
    .select({ id: invitations.id, email: invitations.email, role: invitations.role, workspaceId: invitations.workspaceId, workspaceName: workspaces.name, expiresAt: invitations.expiresAt, acceptedAt: invitations.acceptedAt, pageId: invitations.pageId })
    .from(invitations)
    .innerJoin(workspaces, eq(workspaces.id, invitations.workspaceId))
    .where(eq(invitations.tokenHash, sha256(token)));
  if (!inv) throw new HttpError(404, "Invitación no encontrada");
  return { ...inv, expired: inv.expiresAt.getTime() < Date.now(), used: !!inv.acceptedAt };
}

export async function acceptInvitation(db: Db, user: SessionUser, token: string): Promise<{ workspaceId: string; pageId: string | null }> {
  return db.transaction(async (tx) => {
    const inv = await getInvitation(tx, token);
    if (inv.used) throw new HttpError(410, "Esta invitación ya se usó");
    if (inv.expired) throw new HttpError(410, "Esta invitación ha caducado");
    const current = await memberRole(tx, user.id, inv.workspaceId);
    // Nunca se degrada a un miembro existente.
    if (!current) await tx.insert(workspaceMembers).values({ workspaceId: inv.workspaceId, userId: user.id, role: inv.role });
    else if (current === "guest" && inv.role !== "guest") await tx.update(workspaceMembers).set({ role: inv.role }).where(and(eq(workspaceMembers.workspaceId, inv.workspaceId), eq(workspaceMembers.userId, user.id)));
    const [full] = await tx.select().from(invitations).where(eq(invitations.id, inv.id));
    if (full.pageId && full.pageLevel) {
      await tx.insert(pagePermissions).values({ pageId: full.pageId, userId: user.id, level: full.pageLevel }).onConflictDoUpdate({ target: [pagePermissions.pageId, pagePermissions.userId], set: { level: full.pageLevel } });
    }
    await tx.update(invitations).set({ acceptedAt: new Date() }).where(eq(invitations.id, inv.id));
    return { workspaceId: inv.workspaceId, pageId: full.pageId };
  });
}

export async function listPendingInvitations(db: Db, user: SessionUser, workspaceId: string) {
  await assertMember(db, user, workspaceId, ["owner", "admin"]);
  return (
    await db
      .select({ id: invitations.id, email: invitations.email, role: invitations.role, expiresAt: invitations.expiresAt })
      .from(invitations)
      .where(and(eq(invitations.workspaceId, workspaceId), isNull(invitations.acceptedAt), isNull(invitations.pageId)))
  ).filter((i) => i.expiresAt.getTime() > Date.now());
}

export async function revokeInvitation(db: Db, user: SessionUser, workspaceId: string, id: string) {
  await assertMember(db, user, workspaceId, ["owner", "admin"]);
  await db.delete(invitations).where(and(eq(invitations.id, id), eq(invitations.workspaceId, workspaceId)));
}

// ── Perfil ───────────────────────────────────────────────────────────

export async function updateProfile(db: Db, user: SessionUser, patch: { name?: string }): Promise<SessionUser> {
  if (patch.name !== undefined) await db.update(users).set({ name: patch.name.trim() }).where(eq(users.id, user.id));
  const [u] = await db.select().from(users).where(eq(users.id, user.id));
  return { id: u.id, email: u.email, name: u.name, avatarColor: u.avatarColor };
}
