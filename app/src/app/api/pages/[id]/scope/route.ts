import { z } from "zod";
import { api, readJson } from "@/server/http";
import { setScope } from "@/server/sharing-service";
import { scopeSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

export const PUT = api(async (req, p, user, db) => {
  await setScope(db, user, z.uuid().parse(p.id), scopeSchema.parse(await readJson(req)).scope);
  return null;
});
