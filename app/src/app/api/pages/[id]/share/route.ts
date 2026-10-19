import { z } from "zod";
import { auditPage } from "@/server/audit-service";
import { api, readJson } from "@/server/http";
import { sharePage } from "@/server/sharing-service";
import { shareSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

export const POST = api(async (req, p, user, db) => {
  const input = shareSchema.parse(await readJson(req));
  const id = z.uuid().parse(p.id);
  const res = await sharePage(db, user, id, input);
  await auditPage(db, user, id, "page.share", `${input.email} → ${input.level}`);
  return Response.json(res, { status: 201 });
});
