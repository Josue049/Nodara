import { api } from "@/server/http";
import { deletePageTemplate } from "@/server/templates-service";
import { z } from "zod";

export const dynamic = "force-dynamic";

export const DELETE = api(async (_req, p, user, db) => {
  await deletePageTemplate(db, user, z.uuid().parse(p.id));
  return null;
});
