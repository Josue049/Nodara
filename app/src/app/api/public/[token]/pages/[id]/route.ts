import { z } from "zod";
import { HttpError } from "@/server/auth";
import { publicApi, readJson } from "@/server/http";
import { invalidateRoom } from "@/server/collab-service";
import { getPage, updatePage } from "@/server/pages-service";
import { isWithinShared, resolveShare } from "@/server/sharing-service";
import { updatePageSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

/** Edición anónima: solo si el enlace se publicó con nivel «edit». */
export const PATCH = publicApi(async (req, p, _u, db) => {
  const share = await resolveShare(db, p.token);
  if (!share) throw new HttpError(404, "Enlace no válido");
  if (share.level !== "edit") throw new HttpError(403, "Este enlace es de solo lectura");
  const id = z.uuid().parse(p.id);
  if (!(await isWithinShared(db, id, share.pageId))) throw new HttpError(404, "Página no encontrada");
  if ((await getPage(db, id)).locked) throw new HttpError(403, "La página está bloqueada");
  const { title, content } = updatePageSchema.pick({ title: true, content: true }).parse(await readJson(req));
  await updatePage(db, id, { title, content });
  if (content !== undefined) await invalidateRoom(db, id);
  return null;
});
