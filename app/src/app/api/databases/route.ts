import { getDb } from "@/server/db";
import { api, readJson } from "@/server/http";
import * as C from "@/server/collections-service";
import * as V from "@/server/validation";

export const dynamic = "force-dynamic";

export const GET = api(async () => C.listCollections(await getDb()));

export const POST = api(async (req) => {
  const input = V.createDatabaseSchema.parse(await readJson(req));
  return Response.json(await C.createDatabase(await getDb(), input), { status: 201 });
});
