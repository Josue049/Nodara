import { and, eq, ne } from "drizzle-orm";
import { hashPassword, HttpError, rateLimit, readCookie, sha256, SESSION_COOKIE, verifyPassword } from "@/server/auth";
import { api, readJson } from "@/server/http";
import { sessions, users } from "@/server/schema";
import { passwordSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

export const POST = api(async (req, _p, user, db) => {
  rateLimit(`password:${user.id}`, 8, 10 * 60 * 1000);
  const { current, next } = passwordSchema.parse(await readJson(req));
  const [u] = await db.select().from(users).where(eq(users.id, user.id));
  if (!(await verifyPassword(current, u.passwordHash))) throw new HttpError(400, "La contraseña actual no es correcta");
  await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, user.id));
  // Cierra el resto de sesiones del usuario; conserva la actual.
  const token = readCookie(req, SESSION_COOKIE);
  await db.delete(sessions).where(and(eq(sessions.userId, user.id), token ? ne(sessions.tokenHash, sha256(token)) : undefined));
  return null;
});
