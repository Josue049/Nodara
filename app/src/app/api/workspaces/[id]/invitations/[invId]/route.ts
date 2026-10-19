import { z } from "zod";
import { api } from "@/server/http";
import { revokeInvitation } from "@/server/workspaces-service";

export const dynamic = "force-dynamic";

export const DELETE = api(async (_req, p, user, db) => {
  await revokeInvitation(db, user, z.uuid().parse(p.id), z.uuid().parse(p.invId));
  return null;
});
