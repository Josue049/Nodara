import { z } from "zod";
import { assertPage } from "@/server/authz";
import { applyClientUpdate, fromBase64 } from "@/server/collab-service";
import { api, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

const body = z.object({ cid: z.string().min(8).max(64), update: z.string().min(1).max(6_000_000) });

export const POST = api(async (req, p, user, db) => {
  const pageId = z.uuid().parse(p.id);
  const { cid, update } = body.parse(await readJson(req));
  await assertPage(db, user, pageId, "edit");
  await applyClientUpdate(db, pageId, cid, user.id, fromBase64(update));
  return null;
});
