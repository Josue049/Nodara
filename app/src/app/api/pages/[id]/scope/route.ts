import { z } from "zod";
import { auditPage } from "@/server/audit-service";
import { api, readJson } from "@/server/http";
import { setScope } from "@/server/sharing-service";
import { scopeSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

export const PUT = api(async (req, p, user, db) => {
  const scope = scopeSchema.parse(await readJson(req)).scope;
  await setScope(db, user, z.uuid().parse(p.id), scope);
  await auditPage(db, user, z.uuid().parse(p.id), "page.scope", scope === "workspace" ? "Visible para todo el espacio" : "Solo personas invitadas");
  return null;
});
