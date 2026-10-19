import { z } from "zod";
import { assertCollection } from "@/server/authz";
import { createView } from "@/server/collections-service";
import { api, readJson } from "@/server/http";
import { createViewSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

export const POST = api(async (req, p, user, db) => {
  const id = z.uuid().parse(p.id);
  await assertCollection(db, user, id, "edit");
  const input = createViewSchema.parse(await readJson(req));
  return Response.json(await createView(db, id, input as Parameters<typeof createView>[2]), { status: 201 });
});
