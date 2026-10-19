import { NextResponse } from "next/server";
import { z } from "zod";
import { assertMember } from "@/server/authz";
import { api, readJson, WORKSPACE_COOKIE } from "@/server/http";

export const dynamic = "force-dynamic";

export const POST = api(async (req, _p, user, db) => {
  const { workspaceId } = z.object({ workspaceId: z.uuid() }).parse(await readJson(req));
  await assertMember(db, user, workspaceId);
  const res = NextResponse.json({ workspaceId });
  res.headers.append("Set-Cookie", `${WORKSPACE_COOKIE}=${workspaceId}; Path=/; SameSite=Lax; Max-Age=31536000`);
  return res;
});
