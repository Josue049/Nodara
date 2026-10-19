import { z } from "zod";
import { assertCollection } from "@/server/authz";
import { queryCollection } from "@/server/collections-service";
import { api, readJson } from "@/server/http";
import { querySchema } from "@/server/validation";

export const dynamic = "force-dynamic";

export const POST = api(async (req, p, user, db) => {
  const id = z.uuid().parse(p.id);
  await assertCollection(db, user, id, "view");
  const q = querySchema.parse(await readJson(req));
  return queryCollection(db, id, q as Parameters<typeof queryCollection>[2]);
});
