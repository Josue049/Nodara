import { z } from "zod";
import { recordAudit } from "@/server/audit-service";
import { api, readJson } from "@/server/http";
import { invitationSchema } from "@/server/validation";
import { createInvitation } from "@/server/workspaces-service";

export const dynamic = "force-dynamic";

export const POST = api(async (req, p, user, db) => {
  const input = invitationSchema.parse(await readJson(req));
  const res = await createInvitation(db, user, z.uuid().parse(p.id), input);
  await recordAudit(db, { workspaceId: p.id, actorId: user.id, action: "member.invite", detail: `Rol: ${input.role}` });
  return Response.json(res, { status: 201 });
});
