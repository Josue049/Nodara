import { and, eq, gt, inArray, lt, notExists, sql } from "drizzle-orm";
import { hashPassword, HttpError, type SessionUser } from "./auth";
import type { Db } from "./db";
import { comments, favorites, files, pages, sessions, users, workspaceMembers, workspaces } from "./schema";
import { normalizeEmail, type WorkspaceInfo } from "./workspaces-service";

/**
 * Modo sin cuenta: quien prueba Nodara recibe una cuenta temporal (`is_guest`) con su propio espacio. Al registrarse,
 * esa cuenta se convierte en la definitiva (no se pierde nada); al iniciar sesión en una cuenta existente, sus espacios
 * con contenido pasan a esa cuenta. Las cuentas temporales sin sesión vigente se eliminan con sus espacios.
 */

export const GUEST_NAME = "Invitado";
export const GUEST_WORKSPACE = "Espacio de invitado";
/** Dominio reservado (RFC 6761): nunca coincide con un correo real ni permite iniciar sesión. */
const guestEmail = () => `invitado-${crypto.randomUUID()}@invitado.invalid`;
/** No es un hash scrypt: `verifyPassword` lo rechaza siempre. */
const NO_PASSWORD = "!sin-cuenta";

export async function createGuest(db: Db): Promise<SessionUser> {
  await purgeExpiredGuests(db);
  return db.transaction(async (tx) => {
    const [u] = await tx.insert(users).values({ email: guestEmail(), name: GUEST_NAME, passwordHash: NO_PASSWORD, avatarColor: "gray", isGuest: true }).returning();
    const [ws] = await tx.insert(workspaces).values({ name: GUEST_WORKSPACE, createdBy: u.id }).returning();
    await tx.insert(workspaceMembers).values({ workspaceId: ws.id, userId: u.id, role: "owner" });
    return { id: u.id, email: u.email, name: u.name, avatarColor: u.avatarColor, isGuest: true };
  });
}

/** Espacios en los que el invitado es el único miembro (los suyos): se borran o se transfieren con él. */
async function soloWorkspaces(db: Db, guestId: string): Promise<string[]> {
  const rows = await db
    .select({ id: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.userId, guestId), sql`(select count(*) from workspace_members m where m.workspace_id = ${workspaceMembers.workspaceId}) = 1`));
  return rows.map((r) => r.id);
}

/** Borra una cuenta temporal y sus espacios (las páginas caen en cascada con el espacio). */
export async function deleteGuest(db: Db, guestId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [u] = await tx.select({ isGuest: users.isGuest }).from(users).where(eq(users.id, guestId));
    if (!u?.isGuest) return;
    const own = await soloWorkspaces(tx, guestId);
    if (own.length) await tx.delete(workspaces).where(inArray(workspaces.id, own));
    await tx.delete(users).where(eq(users.id, guestId));
  });
}

/** Limpieza oportunista: cuentas temporales de más de un día sin ninguna sesión vigente (como mucho 50 por llamada). El margen evita borrar una recién creada que aún no tiene sesión. */
export async function purgeExpiredGuests(db: Db): Promise<number> {
  const stale = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.isGuest, true), lt(users.createdAt, new Date(Date.now() - 24 * 3600 * 1000)), notExists(db.select({ x: sql`1` }).from(sessions).where(and(eq(sessions.userId, users.id), gt(sessions.expiresAt, new Date()))))))
    .limit(50);
  for (const s of stale) await deleteGuest(db, s.id);
  return stale.length;
}

/** Convierte la cuenta temporal en una cuenta real con el correo y la contraseña indicados. */
export async function upgradeGuest(db: Db, guestId: string, input: { email: string; name: string; password: string }): Promise<{ user: SessionUser; workspace: WorkspaceInfo | null }> {
  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  const passwordHash = await hashPassword(input.password);
  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (existing) throw new HttpError(409, "Ya existe una cuenta con ese correo");
    const [u] = await tx.update(users).set({ email, name, passwordHash, isGuest: false }).where(and(eq(users.id, guestId), eq(users.isGuest, true))).returning();
    if (!u) throw new HttpError(409, "La cuenta temporal ya no existe");
    const own = await soloWorkspaces(tx, guestId);
    if (own.length) await tx.update(workspaces).set({ name: `Espacio de ${name || email}` }).where(and(inArray(workspaces.id, own), eq(workspaces.name, GUEST_WORKSPACE)));
    const [ws] = own.length ? await tx.select().from(workspaces).where(eq(workspaces.id, own[0])) : [];
    return {
      user: { id: u.id, email: u.email, name: u.name, avatarColor: u.avatarColor, isGuest: false },
      workspace: ws ? { id: ws.id, name: ws.name, icon: ws.icon, role: "owner", memberCount: 1 } : null,
    };
  });
}

/**
 * Tras iniciar sesión desde una cuenta temporal: los espacios del invitado que tengan páginas pasan a la cuenta real
 * (como propietaria, con la autoría de páginas, comentarios, archivos y favoritos); después se borra la cuenta temporal.
 * Devuelve el primer espacio transferido, para abrirlo.
 */
export async function claimGuest(db: Db, guestId: string, userId: string): Promise<string | null> {
  if (guestId === userId) return null;
  const moved = await db.transaction(async (tx) => {
    const [g] = await tx.select({ isGuest: users.isGuest }).from(users).where(eq(users.id, guestId));
    if (!g?.isGuest) return [];
    const own = await soloWorkspaces(tx, guestId);
    if (own.length === 0) return [];
    const withPages = await tx.selectDistinct({ id: pages.workspaceId }).from(pages).where(inArray(pages.workspaceId, own));
    const keep = withPages.map((r) => r.id!).filter(Boolean);
    if (keep.length === 0) return [];
    for (const id of keep) await tx.insert(workspaceMembers).values({ workspaceId: id, userId, role: "owner" }).onConflictDoNothing();
    await tx.update(workspaces).set({ name: "Trabajo sin cuenta", createdBy: userId }).where(and(inArray(workspaces.id, keep), eq(workspaces.name, GUEST_WORKSPACE)));
    await tx.update(workspaces).set({ createdBy: userId }).where(inArray(workspaces.id, keep));
    await tx.update(pages).set({ creatorId: userId }).where(and(inArray(pages.workspaceId, keep), eq(pages.creatorId, guestId)));
    await tx.update(comments).set({ authorId: userId }).where(eq(comments.authorId, guestId));
    await tx.update(files).set({ createdBy: userId }).where(eq(files.createdBy, guestId));
    await tx.update(favorites).set({ userId }).where(eq(favorites.userId, guestId));
    return keep;
  });
  await deleteGuest(db, guestId);
  return moved[0] ?? null;
}
