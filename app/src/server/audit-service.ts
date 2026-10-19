import { and, desc, eq, lt } from "drizzle-orm";
import { toCsv } from "@/lib/export/csv";
import type { SessionUser } from "./auth";
import { pageAccess } from "./authz";
import type { Db } from "./db";
import { auditLog, users } from "./schema";

export type AuditEntry = { id: string; action: string; targetId: string | null; detail: string; createdAt: string; actorName: string | null; actorEmail: string | null };

/** Acciones registradas: etiqueta en español para la interfaz y la exportación. */
export const AUDIT_LABELS: Record<string, string> = {
  "page.trash": "Página enviada a la papelera",
  "page.delete": "Página eliminada definitivamente",
  "page.share": "Página compartida con una persona",
  "page.permission": "Permiso de página cambiado",
  "page.scope": "Acceso general de página cambiado",
  "page.publish": "Página publicada en la web",
  "page.unpublish": "Publicación web retirada",
  "page.export": "Página exportada",
  "page.lock": "Página bloqueada o desbloqueada",
  "page.restore_version": "Versión restaurada",
  "member.invite": "Invitación creada",
  "member.role": "Rol de miembro cambiado",
  "member.remove": "Miembro eliminado",
  "member.reset_password": "Enlace de restablecimiento de contraseña generado",
  "workspace.export": "Copia de seguridad exportada",
  "workspace.update": "Espacio de trabajo modificado",
  "import": "Contenido importado",
};

/** Registra un evento. Un fallo de auditoría nunca debe impedir la operación que se audita. */
export async function recordAudit(db: Db, e: { workspaceId: string | null | undefined; actorId: string | null; action: string; targetId?: string | null; detail?: string }): Promise<void> {
  if (!e.workspaceId) return;
  try {
    await db.insert(auditLog).values({ workspaceId: e.workspaceId, actorId: e.actorId, action: e.action, targetId: e.targetId ?? null, detail: (e.detail ?? "").slice(0, 500) });
  } catch (err) {
    console.error("auditoría:", err);
  }
}

export async function listAudit(db: Db, workspaceId: string, opts: { limit?: number; before?: Date; action?: string } = {}): Promise<AuditEntry[]> {
  const rows = await db
    .select({ id: auditLog.id, action: auditLog.action, targetId: auditLog.targetId, detail: auditLog.detail, createdAt: auditLog.createdAt, actorName: users.name, actorEmail: users.email })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorId))
    .where(and(eq(auditLog.workspaceId, workspaceId), opts.before ? lt(auditLog.createdAt, opts.before) : undefined, opts.action ? eq(auditLog.action, opts.action) : undefined))
    .orderBy(desc(auditLog.createdAt))
    .limit(Math.min(opts.limit ?? 100, 1000));
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

export function auditToCsv(entries: AuditEntry[]): string {
  return toCsv([["Fecha", "Persona", "Correo", "Acción", "Detalle", "Objetivo"], ...entries.map((e) => [e.createdAt, e.actorName ?? "", e.actorEmail ?? "", AUDIT_LABELS[e.action] ?? e.action, e.detail, e.targetId ?? ""])]);
}

/** Registra un evento sobre una página (el espacio de trabajo se deduce de la página). */
export async function auditPage(db: Db, user: SessionUser, pageId: string, action: string, detail = ""): Promise<void> {
  const a = await pageAccess(db, user.id, pageId).catch(() => null);
  await recordAudit(db, { workspaceId: a?.workspaceId, actorId: user.id, action, targetId: pageId, detail });
}
