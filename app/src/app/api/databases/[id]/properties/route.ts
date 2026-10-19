import { z } from "zod";
import { assertCollection } from "@/server/authz";
import { addProperty } from "@/server/collections-service";
import { api, readJson } from "@/server/http";
import { createPropertySchema } from "@/server/validation";

export const dynamic = "force-dynamic";

export const POST = api(async (req, p, user, db) => {
  const id = z.uuid().parse(p.id);
  await assertCollection(db, user, id, "edit");
  return Response.json(await addProperty(db, id, createPropertySchema.parse(await readJson(req))), { status: 201 });
});
