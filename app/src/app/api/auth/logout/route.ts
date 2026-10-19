import { NextResponse } from "next/server";
import { clearedSessionCookie, destroySession, readCookie, SESSION_COOKIE } from "@/server/auth";
import { publicApi } from "@/server/http";

export const dynamic = "force-dynamic";

export const POST = publicApi(async (req, _p, _u, db) => {
  const token = readCookie(req, SESSION_COOKIE);
  if (token) await destroySession(db, token);
  const res = new NextResponse(null, { status: 204 });
  res.headers.append("Set-Cookie", clearedSessionCookie());
  return res;
});
