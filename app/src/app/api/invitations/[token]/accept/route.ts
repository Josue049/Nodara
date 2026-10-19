import { NextResponse } from "next/server";
import { api, WORKSPACE_COOKIE } from "@/server/http";
import { acceptInvitation } from "@/server/workspaces-service";

export const dynamic = "force-dynamic";

export const POST = api(async (_req, p, user, db) => {
  const out = await acceptInvitation(db, user, p.token);
  const res = NextResponse.json(out);
  res.headers.append("Set-Cookie", `${WORKSPACE_COOKIE}=${out.workspaceId}; Path=/; SameSite=Lax; Max-Age=31536000`);
  return res;
});
