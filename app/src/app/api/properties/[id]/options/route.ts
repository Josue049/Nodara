import { z } from "zod";
import { assertCollection } from "@/server/authz";
import { addOption, collectionIdOf } from "@/server/collections-service";
import { api, readJson } from "@/server/http";
import { addOptionSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

export const POST = api(async (req, p, user, db) => {
  const id = z.uuid().parse(p.id);
  await assertCollection(db, user, await collectionIdOf(db, "property", id), "edit");
  return Response.json(await addOption(db, id, addOptionSchema.parse(await readJson(req))), { status: 201 });
});
