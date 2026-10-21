import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { clientIp, createSession, destroySession, dummyVerify, HttpError, rateLimit, readCookie, resetRateLimit, SESSION_COOKIE, sessionCookie, verifyPassword } from "@/server/auth";
import { claimGuest } from "@/server/guest-service";
import { publicApi, readJson, WORKSPACE_COOKIE } from "@/server/http";
import { users } from "@/server/schema";
import { loginSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

export const POST = publicApi(async (req, _p, current, db) => {
  const { email, password } = loginSchema.parse(await readJson(req));
  const key = `login:${clientIp(req)}:${email}`;
  rateLimit(key, 8, 10 * 60 * 1000);
  const [u] = await db.select().from(users).where(eq(users.email, email));
  // Mismo mensaje y coste de cálculo exista o no la cuenta (no revela qué correos están registrados).
  if (!u) {
    await dummyVerify(password);
    throw new HttpError(401, "Correo o contraseña incorrectos");
  }
  if (!(await verifyPassword(password, u.passwordHash))) throw new HttpError(401, "Correo o contraseña incorrectos");
  resetRateLimit(key);
  // Desde el modo sin cuenta, lo creado pasa a la cuenta que inicia sesión y se abre ese espacio.
  let claimed: string | null = null;
  if (current?.isGuest) {
    const old = readCookie(req, SESSION_COOKIE);
    if (old) await destroySession(db, old);
    claimed = await claimGuest(db, current.id, u.id);
  }
  const { token, expiresAt } = await createSession(db, u.id);
  const res = NextResponse.json({ user: { id: u.id, email: u.email, name: u.name, avatarColor: u.avatarColor }, claimedWorkspaceId: claimed });
  res.headers.append("Set-Cookie", sessionCookie(req, token, expiresAt));
  if (claimed) res.headers.append("Set-Cookie", `${WORKSPACE_COOKIE}=${claimed}; Path=/; SameSite=Lax; Max-Age=31536000`);
  return res;
});
