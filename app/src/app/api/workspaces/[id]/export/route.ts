import { z } from "zod";
import { recordAudit } from "@/server/audit-service";
import { assertMember } from "@/server/authz";
import { flushAllRooms } from "@/server/collab-service";
import { api } from "@/server/http";
import { exportWorkspaceBackup } from "@/server/import-export-service";

export const dynamic = "force-dynamic";

/** Copia de seguridad del espacio de trabajo en JSON (solo propietarios y administradores). */
export const GET = api(async (_req, p, user, db) => {
  const id = z.uuid().parse(p.id);
  await assertMember(db, user, id, ["owner", "admin"]);
  await flushAllRooms();
  const backup = await exportWorkspaceBackup(db, id);
  await recordAudit(db, { workspaceId: id, actorId: user.id, action: "workspace.export", detail: `${backup.pages.length} páginas` });
  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="nodara-respaldo-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
