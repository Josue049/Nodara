import { api, readJson } from "@/server/http";
import { workspaceSchema } from "@/server/validation";
import { createWorkspace, listWorkspaces } from "@/server/workspaces-service";

export const dynamic = "force-dynamic";

export const GET = api(async (_req, _p, user, db) => listWorkspaces(db, user.id));
export const POST = api(async (req, _p, user, db) =>
  Response.json(await createWorkspace(db, user, workspaceSchema.parse(await readJson(req)).name), { status: 201 }),
);
