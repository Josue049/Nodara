import { z } from "zod";
import { visiblePages } from "@/server/authz";
import { api, resolveWorkspace } from "@/server/http";
import { searchPages } from "@/server/pages-service";
import { EDITED_WINDOWS } from "@/lib/search";

export const dynamic = "force-dynamic";

const params = z.object({
  q: z.string().max(200).default(""),
  titlesOnly: z.enum(["1", "0"]).optional(),
  /** «me» o el id de una persona. */
  createdBy: z.union([z.literal("me"), z.uuid()]).optional(),
  edited: z.enum(Object.keys(EDITED_WINDOWS) as [keyof typeof EDITED_WINDOWS]).optional(),
  inside: z.uuid().optional(),
  kind: z.enum(["page", "database", "record"]).optional(),
  sort: z.enum(["relevance", "edited"]).optional(),
  workspace: z.uuid().optional(),
});

export const GET = api(async (req, _p, user, db) => {
  const raw = Object.fromEntries(new URL(req.url).searchParams);
  const p = params.parse(raw);
  const ws = await resolveWorkspace(db, user, req, p.workspace ?? null);
  const allowed = new Set((await visiblePages(db, user.id, ws)).map((x) => x.id));
  return searchPages(db, p.q, {
    titlesOnly: p.titlesOnly === "1",
    workspaceId: ws,
    allowed,
    createdBy: p.createdBy === "me" ? user.id : p.createdBy,
    editedWithinDays: p.edited ? EDITED_WINDOWS[p.edited] : undefined,
    inside: p.inside,
    kind: p.kind,
    sort: p.sort,
  });
});
