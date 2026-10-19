import { z } from "zod";
import { assertCollection } from "@/server/authz";
import { collectionIdOf, duplicateView } from "@/server/collections-service";
import { api } from "@/server/http";

export const dynamic = "force-dynamic";

export const POST = api(async (_req, p, user, db) => {
  const id = z.uuid().parse(p.id);
  await assertCollection(db, user, await collectionIdOf(db, "view", id), "edit");
  return Response.json(await duplicateView(db, id), { status: 201 });
});
