import { z } from "zod";
import { assertCollection } from "@/server/authz";
import { collectionIdOf, deleteProperty, updateProperty } from "@/server/collections-service";
import { api, readJson } from "@/server/http";
import { updatePropertySchema } from "@/server/validation";

export const dynamic = "force-dynamic";

export const PATCH = api(async (req, p, user, db) => {
  const id = z.uuid().parse(p.id);
  await assertCollection(db, user, await collectionIdOf(db, "property", id), "edit");
  return updateProperty(db, id, updatePropertySchema.parse(await readJson(req)));
});
export const DELETE = api(async (_req, p, user, db) => {
  const id = z.uuid().parse(p.id);
  await assertCollection(db, user, await collectionIdOf(db, "property", id), "edit");
  await deleteProperty(db, id);
  return null;
});
