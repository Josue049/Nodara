import { NextResponse } from "next/server";
import { clientIp, createSession, rateLimit, sessionCookie } from "@/server/auth";
import { createGuest } from "@/server/guest-service";
import { publicApi } from "@/server/http";

export const dynamic = "force-dynamic";

/** Entrar sin cuenta: crea una cuenta temporal con su espacio. Con sesión ya abierta no hace nada. */
export const POST = publicApi(async (req, _p, current, db) => {
  if (current) return { user: current };
  rateLimit(`guest:${clientIp(req)}`, 300, 10 * 60 * 1000);
  const user = await createGuest(db);
  const { token, expiresAt } = await createSession(db, user.id);
  const res = NextResponse.json({ user }, { status: 201 });
  res.headers.append("Set-Cookie", sessionCookie(req, token, expiresAt));
  return res;
});
