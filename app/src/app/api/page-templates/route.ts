import { z } from "zod";
import { HttpError } from "@/server/auth";
import { assertPage, memberRole } from "@/server/authz";
import { api, readJson, resolveWorkspace } from "@/server/http";
import { listPageTemplates, saveAsTemplate } from "@/server/templates-service";

export const dynamic = "force-dynamic";

export const GET = api(async (req, _p, user, db) => listPageTemplates(db, await resolveWorkspace(db, user, req)));

/** Guarda una página como plantilla del espacio de trabajo. */
export const POST = api(async (req, _p, user, db) => {
  const { pageId, name } = z.object({ pageId: z.uuid(), name: z.string().trim().min(1).max(120) }).parse(await readJson(req));
  const a = await assertPage(db, user, pageId, "view");
  if ((await memberRole(db, user.id, a.workspaceId)) === "guest") throw new HttpError(403, "Los invitados no pueden crear plantillas");
  return Response.json(await saveAsTemplate(db, user, a.workspaceId, pageId, name), { status: 201 });
});
