import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { HttpError } from "@/server/auth";
import { assertPage, pageAccess } from "@/server/authz";
import { api, readJson } from "@/server/http";
import { deletePagePermanently, getPage, trashPage, updatePage } from "@/server/pages-service";
import { favorites } from "@/server/schema";
import { auditPage } from "@/server/audit-service";
import { broadcastMeta, invalidateRoom } from "@/server/collab-service";
import { maybeSnapshot, setFavorite } from "@/server/sharing-service";
import { updatePageSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

const pageId = (v: string) => z.uuid().parse(v);

async function describe(db: Parameters<typeof getPage>[0], userId: string, id: string, level: string, scope: string, canUnlock: boolean) {
  const page = await getPage(db, id);
  const [fav] = await db.select().from(favorites).where(and(eq(favorites.userId, userId), eq(favorites.pageId, id)));
  return { ...page, isFavorite: !!fav, level, scope, canUnlock };
}

export const GET = api(async (_req, p, user, db) => {
  const id = pageId(p.id);
  const a = await assertPage(db, user, id, "view");
  return describe(db, user.id, id, a.level, a.scope, a.canUnlock);
});

export const PATCH = api(async (req, p, user, db) => {
  const id = pageId(p.id);
  const { isFavorite, ...patch } = updatePageSchema.parse(await readJson(req));
  // Bloquear/desbloquear solo requiere poder editar la página sin el bloqueo; el resto de cambios, el nivel efectivo.
  const onlyLock = Object.keys(patch).length === 1 && patch.locked !== undefined;
  let a = await assertPage(db, user, id, isFavorite !== undefined && Object.keys(patch).length === 0 ? "view" : onlyLock ? "comment" : "edit");
  if (onlyLock && !a.canUnlock) throw new HttpError(403, "No tienes permiso para esta acción");
  if (isFavorite !== undefined) await setFavorite(db, user, id, isFavorite);
  if (Object.keys(patch).length > 0) {
    if (patch.parentId) await assertPage(db, user, patch.parentId, "edit");
    await updatePage(db, id, patch);
    if (patch.locked !== undefined) await auditPage(db, user, id, "page.lock", patch.locked ? "bloqueada" : "desbloqueada");
    if (patch.content !== undefined) await invalidateRoom(db, id); // el contenido cambió fuera de la edición colaborativa
    if (patch.title !== undefined) broadcastMeta(id, { title: patch.title });
    if (patch.content !== undefined || patch.title !== undefined) await maybeSnapshot(db, id, user.id);
  }
  a = (await pageAccess(db, user.id, id)) ?? a;
  return describe(db, user.id, id, a.level, a.scope, a.canUnlock);
});

/** Sin parámetros envía a la papelera; con ?permanent=1 elimina definitivamente (solo desde la papelera, con acceso completo). */
export const DELETE = api(async (req, p, user, db) => {
  const id = pageId(p.id);
  if (new URL(req.url).searchParams.get("permanent") === "1") {
    await assertPage(db, user, id, "full");
    await auditPage(db, user, id, "page.delete", (await getPage(db, id)).title);
    await deletePagePermanently(db, id);
  } else {
    await assertPage(db, user, id, "edit");
    await trashPage(db, id);
    await auditPage(db, user, id, "page.trash");
  }
  return null;
});
