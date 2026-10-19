import { NextResponse } from "next/server";
import { clientIp, createSession, rateLimit, sessionCookie } from "@/server/auth";
import { publicApi, readJson } from "@/server/http";
import { signupSchema } from "@/server/validation";
import { registerUser } from "@/server/workspaces-service";

export const dynamic = "force-dynamic";

export const POST = publicApi(async (req, _p, _u, db) => {
  rateLimit(`signup:${clientIp(req)}`, 600, 10 * 60 * 1000);
  const input = signupSchema.parse(await readJson(req));
  const { user, workspace, adopted } = await registerUser(db, input);
  const { token, expiresAt } = await createSession(db, user.id);
  const res = NextResponse.json({ user, workspace, adopted }, { status: 201 });
  res.headers.append("Set-Cookie", sessionCookie(req, token, expiresAt));
  return res;
});
