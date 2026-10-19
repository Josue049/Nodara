import { z } from "zod";
import { assertCollection } from "@/server/authz";
import { api } from "@/server/http";
import { exportCollectionCsv } from "@/server/import-export-service";

export const dynamic = "force-dynamic";

export const GET = api(async (_req, p, user, db) => {
  const id = z.uuid().parse(p.id);
  await assertCollection(db, user, id, "view");
  const out = await exportCollectionCsv(db, id);
  return new Response(out.body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(out.filename)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
});
