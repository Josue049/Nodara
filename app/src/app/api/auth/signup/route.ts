import { NextResponse } from "next/server";
import { clientIp, createSession, destroySession, rateLimit, readCookie, SESSION_COOKIE, sessionCookie } from "@/server/auth";
import { upgradeGuest } from "@/server/guest-service";
import { publicApi, readJson } from "@/server/http";
import { signupSchema } from "@/server/validation";
import { registerUser } from "@/server/workspaces-service";

export const dynamic = "force-dynamic";

export const POST = publicApi(async (req, _p, current, db) => {
  rateLimit(`signup:${clientIp(req)}`, 600, 10 * 60 * 1000);
  const input = signupSchema.parse(await readJson(req));
  // Desde el modo sin cuenta, la cuenta temporal se convierte en la definitiva y conserva todo lo creado.
  const out = current?.isGuest ? { ...(await upgradeGuest(db, current.id, input)), adopted: 0, kept: true } : { ...(await registerUser(db, input)), kept: false };
  const old = readCookie(req, SESSION_COOKIE);
  if (old && current?.isGuest) await destroySession(db, old);
  const { token, expiresAt } = await createSession(db, out.user.id);
  const res = NextResponse.json(out, { status: 201 });
  res.headers.append("Set-Cookie", sessionCookie(req, token, expiresAt));
  return res;
});
