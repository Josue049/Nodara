import { and, asc, eq } from "drizzle-orm";
import { BUILTIN_TEMPLATES } from "@/lib/templates";
import { HttpError, type SessionUser } from "./auth";
import { memberRole } from "./authz";
import type { Db } from "./db";
import { createPage, getPage, updatePage } from "./pages-service";
import { pageTemplates } from "./schema";

export type TemplateInfo = { id: string; name: string; description: string; icon: string | null; builtin: boolean; createdBy?: string | null };

export async function listPageTemplates(db: Db, workspaceId: string): Promise<TemplateInfo[]> {
  const custom = await db.select().from(pageTemplates).where(eq(pageTemplates.workspaceId, workspaceId)).orderBy(asc(pageTemplates.createdAt));
  return [
    ...BUILTIN_TEMPLATES.map((b) => ({ id: `builtin:${b.key}`, name: b.name, description: b.description, icon: b.icon, builtin: true })),
    ...custom.map((c) => ({ id: c.id, name: c.name, description: "Plantilla del espacio de trabajo", icon: c.icon, builtin: false, createdBy: c.createdBy })),
  ];
}

/** Guarda el contenido de una página como plantilla del espacio de trabajo. */
export async function saveAsTemplate(db: Db, user: SessionUser, workspaceId: string, pageId: string, name: string): Promise<TemplateInfo> {
  const page = await getPage(db, pageId);
  const [row] = await db
    .insert(pageTemplates)
    .values({ workspaceId, name: name.trim().slice(0, 120) || page.title || "Plantilla", icon: page.icon, content: page.content as object, createdBy: user.id })
    .returning();
  return { id: row.id, name: row.name, description: "Plantilla del espacio de trabajo", icon: row.icon, builtin: false, createdBy: row.createdBy };
}

export async function deletePageTemplate(db: Db, user: SessionUser, id: string): Promise<void> {
  const [row] = await db.select().from(pageTemplates).where(eq(pageTemplates.id, id));
  if (!row) throw new HttpError(404, "Plantilla no encontrada");
  const role = await memberRole(db, user.id, row.workspaceId);
  if (!role) throw new HttpError(404, "Plantilla no encontrada");
  if (row.createdBy !== user.id && role !== "owner" && role !== "admin") throw new HttpError(403, "No tienes permiso para esta acción");
  await db.delete(pageTemplates).where(and(eq(pageTemplates.id, id)));
}

/** Contenido, título e icono de una plantilla (integrada o del espacio de trabajo indicado). */
export async function resolveTemplate(db: Db, workspaceId: string, templateId: string): Promise<{ title: string; icon: string | null; content: unknown }> {
  if (templateId.startsWith("builtin:")) {
    const b = BUILTIN_TEMPLATES.find((t) => t.key === templateId.slice(8));
    if (!b) throw new HttpError(404, "Plantilla no encontrada");
    return { title: b.title, icon: b.icon, content: b.content };
  }
  const [row] = await db.select().from(pageTemplates).where(and(eq(pageTemplates.id, templateId), eq(pageTemplates.workspaceId, workspaceId)));
  if (!row) throw new HttpError(404, "Plantilla no encontrada");
  return { title: row.name, icon: row.icon, content: row.content };
}

export async function createFromTemplate(db: Db, user: SessionUser, input: { workspaceId: string; parentId?: string | null; templateId: string }) {
  const tpl = await resolveTemplate(db, input.workspaceId, input.templateId);
  const page = await createPage(db, { parentId: input.parentId ?? null, workspaceId: input.workspaceId, creatorId: user.id, title: tpl.title, icon: tpl.icon });
  return updatePage(db, page.id, { content: tpl.content as never });
}
