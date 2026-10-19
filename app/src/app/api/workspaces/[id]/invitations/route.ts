import { z } from "zod";
import { api, readJson } from "@/server/http";
import { invitationSchema } from "@/server/validation";
import { createInvitation } from "@/server/workspaces-service";

export const dynamic = "force-dynamic";

export const POST = api(async (req, p, user, db) => {
  const input = invitationSchema.parse(await readJson(req));
  return Response.json(await createInvitation(db, user, z.uuid().parse(p.id), input), { status: 201 });
});
