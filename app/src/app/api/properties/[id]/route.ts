import { z } from "zod";
import { getDb } from "@/server/db";
import { api, readJson } from "@/server/http";
import * as C from "@/server/collections-service";
import * as V from "@/server/validation";

export const dynamic = "force-dynamic";
const uuid = (v: string) => z.uuid().parse(v);

export const PATCH = api(async (req, p) => C.updateProperty(await getDb(), uuid(p.id), V.updatePropertySchema.parse(await readJson(req))));
export const DELETE = api(async (_req, p) => {
  await C.deleteProperty(await getDb(), uuid(p.id));
  return null;
});
