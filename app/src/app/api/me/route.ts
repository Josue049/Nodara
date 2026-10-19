import { NextResponse } from "next/server";
import { publicApi, readJson, resolveWorkspace } from "@/server/http";
import { profileSchema } from "@/server/validation";
import { listWorkspaces, updateProfile } from "@/server/workspaces-service";

export const dynamic = "force-dynamic";

export const GET = publicApi(async (req, _p, user, db) => {
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  const workspaces = await listWorkspaces(db, user.id);
  const currentWorkspaceId = workspaces.length ? await resolveWorkspace(db, user, req) : null;
  return { user, workspaces, currentWorkspaceId };
});

export const PATCH = publicApi(async (req, _p, user, db) => {
  if (!user) return NextResponse.json({ error: "Inicia sesión para continuar" }, { status: 401 });
  return updateProfile(db, user, profileSchema.parse(await readJson(req)));
});
