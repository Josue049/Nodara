import { z } from "zod";
import { api, readJson } from "@/server/http";
import { workspacePatchSchema } from "@/server/validation";
import { deleteWorkspace, updateWorkspace } from "@/server/workspaces-service";

export const dynamic = "force-dynamic";

const id = (v: string) => z.uuid().parse(v);
export const PATCH = api(async (req, p, user, db) => updateWorkspace(db, user, id(p.id), workspacePatchSchema.parse(await readJson(req))));
export const DELETE = api(async (_req, p, user, db) => {
  await deleteWorkspace(db, user, id(p.id));
  return null;
});
