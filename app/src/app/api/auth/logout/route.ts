import { NextResponse } from "next/server";
import { clearedSessionCookie, destroySession, readCookie, SESSION_COOKIE } from "@/server/auth";
import { deleteGuest } from "@/server/guest-service";
import { publicApi } from "@/server/http";

export const dynamic = "force-dynamic";

export const POST = publicApi(async (req, _p, user, db) => {
  const token = readCookie(req, SESSION_COOKIE);
  if (token) await destroySession(db, token);
  // Una cuenta temporal no puede volver a abrirse: al salir se descarta con su contenido.
  if (user?.isGuest) await deleteGuest(db, user.id);
  const res = new NextResponse(null, { status: 204 });
  res.headers.append("Set-Cookie", clearedSessionCookie());
  return res;
});
