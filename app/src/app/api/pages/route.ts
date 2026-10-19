import { HttpError } from "@/server/auth";
import { assertPage, memberRole, pageAccess, visiblePages } from "@/server/authz";
import { api, readJson, resolveWorkspace } from "@/server/http";
import { createPage } from "@/server/pages-service";
import { createPageSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

export const GET = api(async (req, _p, user, db) => {
  const ws = await resolveWorkspace(db, user, req, new URL(req.url).searchParams.get("workspace"));
  return visiblePages(db, user.id, ws);
});

export const POST = api(async (req, _p, user, db) => {
  const input = createPageSchema.parse(await readJson(req));
  let workspaceId: string;
  if (input.parentId) {
    workspaceId = (await assertPage(db, user, input.parentId, "edit")).workspaceId;
  } else {
    workspaceId = await resolveWorkspace(db, user, req, input.workspaceId);
    if ((await memberRole(db, user.id, workspaceId)) === "guest") throw new HttpError(403, "Los invitados no pueden crear páginas en la raíz");
  }
  const row = await createPage(db, { ...input, workspaceId, creatorId: user.id });
  const access = await pageAccess(db, user.id, row.id);
  return Response.json({ ...row, level: access?.level ?? "full", scope: access?.scope ?? "private", isFavorite: false }, { status: 201 });
});
