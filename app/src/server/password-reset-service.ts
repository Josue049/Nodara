import { and, eq, isNull } from "drizzle-orm";
import { hashPassword, HttpError, newToken, sha256, type SessionUser } from "./auth";
import { memberRole } from "./authz";
import type { Db } from "./db";
import { passwordResets, sessions, users } from "./schema";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hora

/**
 * Un propietario o administrador genera un enlace de un solo uso para que un miembro de su espacio defina una contraseña nueva.
 * Un administrador no puede restablecer a un propietario ni a sí mismo (para eso existe «Cambiar contraseña»).
 */
export async function createPasswordReset(db: Db, actor: SessionUser, workspaceId: string, targetUserId: string): Promise<{ token: string; expiresAt: Date; email: string }> {
  const actorRole = await memberRole(db, actor.id, workspaceId);
  if (actorRole !== "owner" && actorRole !== "admin") throw new HttpError(403, "No tienes permiso para esta acción");
  if (targetUserId === actor.id) throw new HttpError(400, "Para cambiar tu propia contraseña usa tu cuenta");
  const targetRole = await memberRole(db, targetUserId, workspaceId);
  if (!targetRole) throw new HttpError(404, "Miembro no encontrado");
  if (targetRole === "owner" && actorRole !== "owner") throw new HttpError(403, "Solo un propietario puede restablecer a otro propietario");
  const [u] = await db.select().from(users).where(eq(users.id, targetUserId));
  if (!u) throw new HttpError(404, "Miembro no encontrado");
  // Un solo enlace vigente por persona: los anteriores se invalidan.
  await db.update(passwordResets).set({ usedAt: new Date() }).where(and(eq(passwordResets.userId, targetUserId), isNull(passwordResets.usedAt)));
  const token = newToken();
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);
  await db.insert(passwordResets).values({ userId: targetUserId, tokenHash: sha256(token), createdBy: actor.id, expiresAt });
  return { token, expiresAt, email: u.email };
}

async function findReset(db: Db, token: string) {
  const [row] = await db
    .select({ id: passwordResets.id, userId: passwordResets.userId, expiresAt: passwordResets.expiresAt, usedAt: passwordResets.usedAt, email: users.email, name: users.name })
    .from(passwordResets)
    .innerJoin(users, eq(users.id, passwordResets.userId))
    .where(eq(passwordResets.tokenHash, sha256(token)));
  return row ?? null;
}

export async function getPasswordReset(db: Db, token: string): Promise<{ email: string; name: string }> {
  const r = await findReset(db, token);
  if (!r || r.usedAt || r.expiresAt.getTime() < Date.now()) throw new HttpError(404, "Enlace no válido o caducado");
  return { email: r.email, name: r.name };
}

/** Define la contraseña nueva, invalida el enlace y cierra todas las sesiones abiertas de esa cuenta. */
export async function completePasswordReset(db: Db, token: string, password: string): Promise<{ email: string }> {
  const r = await findReset(db, token);
  if (!r || r.usedAt || r.expiresAt.getTime() < Date.now()) throw new HttpError(404, "Enlace no válido o caducado");
  const hash = await hashPassword(password);
  await db.transaction(async (tx) => {
    // «usedAt IS NULL» en la condición evita que dos usos simultáneos del mismo enlace tengan éxito.
    const used = await tx.update(passwordResets).set({ usedAt: new Date() }).where(and(eq(passwordResets.id, r.id), isNull(passwordResets.usedAt))).returning({ id: passwordResets.id });
    if (used.length === 0) throw new HttpError(404, "Enlace no válido o caducado");
    await tx.update(users).set({ passwordHash: hash }).where(eq(users.id, r.userId));
    await tx.delete(sessions).where(eq(sessions.userId, r.userId));
  });
  return { email: r.email };
}

