import { z } from "zod";
import { assertPage } from "@/server/authz";
import { api } from "@/server/http";
import { restorePage } from "@/server/pages-service";

export const dynamic = "force-dynamic";

export const POST = api(async (_req, p, user, db) => {
  const id = z.uuid().parse(p.id);
  await assertPage(db, user, id, "edit");
  return restorePage(db, id);
});
