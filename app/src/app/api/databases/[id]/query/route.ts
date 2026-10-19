import { z } from "zod";
import { getDb } from "@/server/db";
import { api, readJson } from "@/server/http";
import * as C from "@/server/collections-service";
import * as V from "@/server/validation";

export const dynamic = "force-dynamic";
const uuid = (v: string) => z.uuid().parse(v);

export const POST = api(async (req, p) => {
  const q = V.querySchema.parse(await readJson(req));
  return C.queryCollection(await getDb(), uuid(p.id), q as Parameters<typeof C.queryCollection>[2]);
});
