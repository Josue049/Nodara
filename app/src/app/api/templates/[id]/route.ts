import { z } from "zod";
import { assertCollection } from "@/server/authz";
import { collectionIdOf, deleteTemplate, updateTemplate } from "@/server/collections-service";
import { api, readJson } from "@/server/http";
import { templateSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

export const PATCH = api(async (req, p, user, db) => {
  const id = z.uuid().parse(p.id);
  await assertCollection(db, user, await collectionIdOf(db, "template", id), "edit");
  return updateTemplate(db, id, templateSchema.partial().parse(await readJson(req)));
});
export const DELETE = api(async (_req, p, user, db) => {
  const id = z.uuid().parse(p.id);
  await assertCollection(db, user, await collectionIdOf(db, "template", id), "edit");
  await deleteTemplate(db, id);
  return null;
});
