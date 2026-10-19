import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { clientIp, createSession, dummyVerify, HttpError, rateLimit, resetRateLimit, sessionCookie, verifyPassword } from "@/server/auth";
import { publicApi, readJson } from "@/server/http";
import { users } from "@/server/schema";
import { loginSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

export const POST = publicApi(async (req, _p, _u, db) => {
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
  const { token, expiresAt } = await createSession(db, u.id);
  const res = NextResponse.json({ user: { id: u.id, email: u.email, name: u.name, avatarColor: u.avatarColor } });
  res.headers.append("Set-Cookie", sessionCookie(req, token, expiresAt));
  return res;
});
