import { z } from "zod";
import { HttpError } from "@/server/auth";
import { assertPage, memberRole } from "@/server/authz";
import { api, readJson, resolveWorkspace } from "@/server/http";
import { createFromTemplate } from "@/server/templates-service";

export const dynamic = "force-dynamic";

/** Crea una página nueva a partir de una plantilla (integrada: «builtin:<clave>», o del espacio de trabajo). */
export const POST = api(async (req, _p, user, db) => {
  const { templateId, parentId } = z.object({ templateId: z.string().min(1).max(80), parentId: z.uuid().nullable().optional() }).parse(await readJson(req));
  let workspaceId: string;
  if (parentId) workspaceId = (await assertPage(db, user, parentId, "edit")).workspaceId;
  else {
    workspaceId = await resolveWorkspace(db, user, req);
    if ((await memberRole(db, user.id, workspaceId)) === "guest") throw new HttpError(403, "Los invitados no pueden crear páginas en la raíz");
  }
  const page = await createFromTemplate(db, user, { workspaceId, parentId, templateId });
  return Response.json(page, { status: 201 });
});
