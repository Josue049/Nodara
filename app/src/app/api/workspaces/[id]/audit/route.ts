import { z } from "zod";
import { auditToCsv, listAudit } from "@/server/audit-service";
import { assertMember } from "@/server/authz";
import { api } from "@/server/http";

export const dynamic = "force-dynamic";

/** Registro de auditoría (solo propietarios y administradores). `?format=csv` lo descarga. */
export const GET = api(async (req, p, user, db) => {
  const id = z.uuid().parse(p.id);
  await assertMember(db, user, id, ["owner", "admin"]);
  const q = new URL(req.url).searchParams;
  const before = q.get("before") ? new Date(q.get("before")!) : undefined;
  const entries = await listAudit(db, id, { limit: Number(q.get("limit") ?? 100) || 100, before: before && !Number.isNaN(before.getTime()) ? before : undefined, action: q.get("action") ?? undefined });
  if (q.get("format") === "csv") {
    return new Response(auditToCsv(entries), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="auditoria.csv"', "Cache-Control": "no-store" } });
  }
  return Response.json(entries);
});
