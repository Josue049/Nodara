import { z } from "zod";
import { HttpError } from "@/server/auth";
import { getBundle, queryCollection } from "@/server/collections-service";
import { publicApi, readJson } from "@/server/http";
import { isWithinShared, resolveShare } from "@/server/sharing-service";
import { querySchema } from "@/server/validation";

export const dynamic = "force-dynamic";

export const POST = publicApi(async (req, p, _u, db) => {
  const share = await resolveShare(db, p.token);
  if (!share) throw new HttpError(404, "Enlace no válido");
  const cid = z.uuid().parse(p.cid);
  const host = (await getBundle(db, cid)).collection.hostPageId;
  if (!(await isWithinShared(db, host, share.pageId))) throw new HttpError(404, "Base de datos no encontrada");
  // En enlaces públicos no se revela la lista de miembros del espacio.
  return queryCollection(db, cid, { ...(querySchema.parse(await readJson(req)) as Parameters<typeof queryCollection>[2]), includeMembers: false });
});
