import { z } from "zod";
import { getDb } from "@/server/db";
import { api, readJson } from "@/server/http";
import * as C from "@/server/collections-service";
import * as V from "@/server/validation";

export const dynamic = "force-dynamic";
const uuid = (v: string) => z.uuid().parse(v);

export const POST = api(async (req, p) => {
  const input = V.addOptionSchema.parse(await readJson(req));
  return Response.json(await C.addOption(await getDb(), uuid(p.id), input), { status: 201 });
});
