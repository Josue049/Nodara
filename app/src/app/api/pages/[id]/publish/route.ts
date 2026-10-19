import { z } from "zod";
import { auditPage } from "@/server/audit-service";
import { api, readJson } from "@/server/http";
import { publishPage, unpublishPage } from "@/server/sharing-service";
import { publishSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

export const POST = api(async (req, p, user, db) => {
  const id = z.uuid().parse(p.id);
  const level = publishSchema.parse(await readJson(req)).level;
  const res = await publishPage(db, user, id, level);
  await auditPage(db, user, id, "page.publish", `enlace público (${level})`);
  return res;
});
export const DELETE = api(async (_req, p, user, db) => {
  await unpublishPage(db, user, z.uuid().parse(p.id));
  await auditPage(db, user, z.uuid().parse(p.id), "page.unpublish");
  return null;
});
