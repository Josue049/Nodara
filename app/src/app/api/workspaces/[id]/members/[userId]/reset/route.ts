import { z } from "zod";
import { recordAudit } from "@/server/audit-service";
import { api } from "@/server/http";
import { createPasswordReset } from "@/server/password-reset-service";

export const dynamic = "force-dynamic";

/** Genera un enlace de restablecimiento de contraseña (solo propietarios y administradores). */
export const POST = api(async (_req, p, user, db) => {
  const workspaceId = z.uuid().parse(p.id);
  const targetId = z.uuid().parse(p.userId);
  const out = await createPasswordReset(db, user, workspaceId, targetId);
  await recordAudit(db, { workspaceId, actorId: user.id, action: "member.reset_password", targetId, detail: out.email });
  return Response.json({ path: `/reset/${out.token}`, expiresAt: out.expiresAt.toISOString(), email: out.email }, { status: 201 });
});
