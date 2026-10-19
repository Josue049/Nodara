import { z } from "zod";
import { recordAudit } from "@/server/audit-service";
import { api, readJson } from "@/server/http";
import { memberRoleSchema } from "@/server/validation";
import { removeMember, setMemberRole } from "@/server/workspaces-service";

export const dynamic = "force-dynamic";

export const PATCH = api(async (req, p, user, db) => {
  const role = memberRoleSchema.parse(await readJson(req)).role;
  await setMemberRole(db, user, z.uuid().parse(p.id), z.uuid().parse(p.userId), role);
  await recordAudit(db, { workspaceId: p.id, actorId: user.id, action: "member.role", targetId: p.userId, detail: `Nuevo rol: ${role}` });
  return null;
});
export const DELETE = api(async (_req, p, user, db) => {
  await removeMember(db, user, z.uuid().parse(p.id), z.uuid().parse(p.userId));
  await recordAudit(db, { workspaceId: p.id, actorId: user.id, action: "member.remove", targetId: p.userId });
  return null;
});
