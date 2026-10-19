import { HttpError } from "@/server/auth";
import { assertPage, memberRole } from "@/server/authz";
import { createDatabase, listCollections } from "@/server/collections-service";
import { api, readJson, resolveWorkspace } from "@/server/http";
import { createDatabaseSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

export const GET = api(async (req, _p, user, db) => {
  const ws = await resolveWorkspace(db, user, req, new URL(req.url).searchParams.get("workspace"));
  return (await listCollections(db)).filter((c) => c.workspaceId === ws);
});

export const POST = api(async (req, _p, user, db) => {
  const input = createDatabaseSchema.parse(await readJson(req));
  let workspaceId: string;
  const anchor = input.hostPageId ?? input.parentId;
  if (anchor) workspaceId = (await assertPage(db, user, anchor, "edit")).workspaceId;
  else {
    workspaceId = await resolveWorkspace(db, user, req, input.workspaceId);
    if ((await memberRole(db, user.id, workspaceId)) === "guest") throw new HttpError(403, "Los invitados no pueden crear bases de datos en la raíz");
  }
  return Response.json(await createDatabase(db, { ...input, workspaceId, creatorId: user.id }), { status: 201 });
});
