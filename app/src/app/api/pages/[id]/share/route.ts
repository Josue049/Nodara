import { z } from "zod";
import { api, readJson } from "@/server/http";
import { sharePage } from "@/server/sharing-service";
import { shareSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

export const POST = api(async (req, p, user, db) => {
  const input = shareSchema.parse(await readJson(req));
  return Response.json(await sharePage(db, user, z.uuid().parse(p.id), input), { status: 201 });
});
