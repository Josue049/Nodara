import { z } from "zod";
import { assertCollection } from "@/server/authz";
import { createTemplate, listTemplates } from "@/server/collections-service";
import { api, readJson } from "@/server/http";
import { templateSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

export const GET = api(async (_req, p, user, db) => {
  const id = z.uuid().parse(p.id);
  await assertCollection(db, user, id, "view");
  return listTemplates(db, id);
});
export const POST = api(async (req, p, user, db) => {
  const id = z.uuid().parse(p.id);
  await assertCollection(db, user, id, "edit");
  return Response.json(await createTemplate(db, id, templateSchema.parse(await readJson(req))), { status: 201 });
});
