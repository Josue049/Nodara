import { z } from "zod";
import { getDb } from "@/server/db";
import { api, readJson } from "@/server/http";
import * as C from "@/server/collections-service";
import * as V from "@/server/validation";

export const dynamic = "force-dynamic";
const uuid = (v: string) => z.uuid().parse(v);

export const GET = api(async (_req, p) => C.getBundle(await getDb(), uuid(p.id)));
export const PATCH = api(async (req, p) => C.updateCollection(await getDb(), uuid(p.id), V.updateCollectionSchema.parse(await readJson(req))));
