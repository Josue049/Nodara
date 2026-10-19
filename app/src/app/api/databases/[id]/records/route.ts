import { z } from "zod";
import { assertCollection } from "@/server/authz";
import { addRecord } from "@/server/collections-service";
import { api, readJson } from "@/server/http";
import { createRecordSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

export const POST = api(async (req, p, user, db) => {
  const id = z.uuid().parse(p.id);
  await assertCollection(db, user, id, "edit");
  return Response.json(await addRecord(db, id, { ...createRecordSchema.parse(await readJson(req)), creatorId: user.id }), { status: 201 });
});
