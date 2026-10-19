import { z } from "zod";
import { assertCollection } from "@/server/authz";
import { getBundle, updateCollection } from "@/server/collections-service";
import { api, readJson } from "@/server/http";
import { updateCollectionSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

const cid = (v: string) => z.uuid().parse(v);
export const GET = api(async (_req, p, user, db) => {
  await assertCollection(db, user, cid(p.id), "view");
  return getBundle(db, cid(p.id));
});
export const PATCH = api(async (req, p, user, db) => {
  await assertCollection(db, user, cid(p.id), "edit");
  return updateCollection(db, cid(p.id), updateCollectionSchema.parse(await readJson(req)));
});
