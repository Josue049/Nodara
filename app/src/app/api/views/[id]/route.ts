import { z } from "zod";
import { getDb } from "@/server/db";
import { api, readJson } from "@/server/http";
import * as C from "@/server/collections-service";
import * as V from "@/server/validation";

export const dynamic = "force-dynamic";
const uuid = (v: string) => z.uuid().parse(v);

export const PATCH = api(async (req, p) => C.updateView(await getDb(), uuid(p.id), V.updateViewSchema.parse(await readJson(req)) as Parameters<typeof C.updateView>[2]));
export const DELETE = api(async (_req, p) => {
  await C.deleteView(await getDb(), uuid(p.id));
  return null;
});
