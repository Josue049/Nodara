import { z } from "zod";
import { assertPage } from "@/server/authz";
import { api, readJson } from "@/server/http";
import { movePage } from "@/server/pages-service";

export const dynamic = "force-dynamic";

const moveSchema = z.object({ parentId: z.uuid().nullable(), index: z.number().int().min(0) });

export const POST = api(async (req, p, user, db) => {
  const id = z.uuid().parse(p.id);
  const target = moveSchema.parse(await readJson(req));
  await assertPage(db, user, id, "edit");
  if (target.parentId) await assertPage(db, user, target.parentId, "edit");
  return movePage(db, id, target);
});
