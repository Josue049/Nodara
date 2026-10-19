import { z } from "zod";
import { assertPage } from "@/server/authz";
import { bundleForPage } from "@/server/collections-service";
import { api } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = api(async (_req, p, user, db) => {
  const id = z.uuid().parse(p.id);
  await assertPage(db, user, id, "view");
  return (await bundleForPage(db, id)) ?? Response.json({ error: "La página no es una base de datos" }, { status: 404 });
});
