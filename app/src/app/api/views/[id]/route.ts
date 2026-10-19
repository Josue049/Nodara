import { z } from "zod";
import { assertCollection } from "@/server/authz";
import { collectionIdOf, deleteView, updateView } from "@/server/collections-service";
import { api, readJson } from "@/server/http";
import { updateViewSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

export const PATCH = api(async (req, p, user, db) => {
  const id = z.uuid().parse(p.id);
  await assertCollection(db, user, await collectionIdOf(db, "view", id), "edit");
  return updateView(db, id, updateViewSchema.parse(await readJson(req)) as Parameters<typeof updateView>[2]);
});
export const DELETE = api(async (_req, p, user, db) => {
  const id = z.uuid().parse(p.id);
  await assertCollection(db, user, await collectionIdOf(db, "view", id), "edit");
  await deleteView(db, id);
  return null;
});
