import { z } from "zod";
import { api, readJson } from "@/server/http";
import { memberRoleSchema } from "@/server/validation";
import { removeMember, setMemberRole } from "@/server/workspaces-service";

export const dynamic = "force-dynamic";

export const PATCH = api(async (req, p, user, db) => {
  await setMemberRole(db, user, z.uuid().parse(p.id), z.uuid().parse(p.userId), memberRoleSchema.parse(await readJson(req)).role);
  return null;
});
export const DELETE = api(async (_req, p, user, db) => {
  await removeMember(db, user, z.uuid().parse(p.id), z.uuid().parse(p.userId));
  return null;
});
