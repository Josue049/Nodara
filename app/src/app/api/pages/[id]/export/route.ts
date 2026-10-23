import { z } from "zod";
import { auditPage } from "@/server/audit-service";
import { assertPage } from "@/server/authz";
import { flushRoom } from "@/server/collab-service";
import { api } from "@/server/http";
import { exportPage } from "@/server/import-export-service";

export const dynamic = "force-dynamic";

const format = z.enum(["md", "html", "json"]);

/** Descarga la página como Markdown, HTML o JSON. */
export const GET = api(async (req, p, user, db) => {
  const id = z.uuid().parse(p.id);
  await assertPage(db, user, id, "view");
  const f = format.parse(new URL(req.url).searchParams.get("format") ?? "md");
  // Lo último escrito puede estar aún solo en la sala colaborativa (se guarda con retardo): se vuelca antes de leer.
  await flushRoom(id);
  const out = await exportPage(db, id, f);
  await auditPage(db, user, id, "page.export", f);
  return new Response(out.body, {
    headers: {
      "Content-Type": out.contentType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(out.filename)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
});
