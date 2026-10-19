import { visiblePages } from "@/server/authz";
import { api, resolveWorkspace } from "@/server/http";
import { searchPages } from "@/server/pages-service";

export const dynamic = "force-dynamic";

export const GET = api(async (req, _p, user, db) => {
  const url = new URL(req.url);
  const ws = await resolveWorkspace(db, user, req, url.searchParams.get("workspace"));
  const allowed = new Set((await visiblePages(db, user.id, ws)).map((p) => p.id));
  return searchPages(db, url.searchParams.get("q") ?? "", { titlesOnly: url.searchParams.get("titlesOnly") === "1", workspaceId: ws, allowed });
});
