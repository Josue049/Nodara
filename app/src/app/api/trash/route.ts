import { atLeast, pageAccess } from "@/server/authz";
import { api, resolveWorkspace } from "@/server/http";
import { listTrash } from "@/server/pages-service";

export const dynamic = "force-dynamic";

export const GET = api(async (req, _p, user, db) => {
  const ws = await resolveWorkspace(db, user, req, new URL(req.url).searchParams.get("workspace"));
  const out = [];
  for (const page of await listTrash(db, ws)) {
    const a = await pageAccess(db, user.id, page.id);
    if (a && atLeast(a.level, "edit")) out.push(page);
  }
  return out;
});
