import { z } from "zod";
import { api } from "@/server/http";
import { listMembers, listPendingInvitations } from "@/server/workspaces-service";

export const dynamic = "force-dynamic";

export const GET = api(async (_req, p, user, db) => {
  const id = z.uuid().parse(p.id);
  const members = await listMembers(db, user, id);
  const me = members.find((m) => m.userId === user.id);
  const pending = me && (me.role === "owner" || me.role === "admin") ? await listPendingInvitations(db, user, id) : [];
  return { members, pending };
});
