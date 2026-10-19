import { z } from "zod";
import { HttpError } from "@/server/auth";
import { assertPage } from "@/server/authz";
import { api } from "@/server/http";
import { duplicatePage } from "@/server/pages-service";

export const dynamic = "force-dynamic";

export const POST = api(async (_req, p, user, db) => {
  const id = z.uuid().parse(p.id);
  const a = await assertPage(db, user, id, "edit");
  if (a.role === "guest") throw new HttpError(403, "Los invitados no pueden duplicar páginas");
  return Response.json(await duplicatePage(db, id, user.id), { status: 201 });
});
