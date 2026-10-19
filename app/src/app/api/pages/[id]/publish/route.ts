import { z } from "zod";
import { api, readJson } from "@/server/http";
import { publishPage, unpublishPage } from "@/server/sharing-service";
import { publishSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

export const POST = api(async (req, p, user, db) => publishPage(db, user, z.uuid().parse(p.id), publishSchema.parse(await readJson(req)).level));
export const DELETE = api(async (_req, p, user, db) => {
  await unpublishPage(db, user, z.uuid().parse(p.id));
  return null;
});
