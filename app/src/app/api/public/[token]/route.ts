import { z } from "zod";
import { HttpError } from "@/server/auth";
import { bundleForPage } from "@/server/collections-service";
import { publicApi } from "@/server/http";
import { getPage } from "@/server/pages-service";
import { isWithinShared, resolveShare } from "@/server/sharing-service";

export const dynamic = "force-dynamic";

/** Página publicada (o una de sus subpáginas con ?page=). No exige sesión. */
export const GET = publicApi(async (req, p, _u, db) => {
  const share = await resolveShare(db, p.token);
  if (!share) throw new HttpError(404, "Enlace no válido");
  const asked = new URL(req.url).searchParams.get("page");
  const id = asked ? z.uuid().parse(asked) : share.pageId;
  if (!(await isWithinShared(db, id, share.pageId))) throw new HttpError(404, "Página no encontrada");
  const page = await getPage(db, id);
  if (page.deletedAt) throw new HttpError(404, "Página no encontrada");
  const database = page.kind === "database" ? await bundleForPage(db, id) : null;
  return {
    level: share.level,
    rootId: share.pageId,
    page: { id: page.id, parentId: page.parentId, title: page.title, icon: page.icon, kind: page.kind, content: page.content, collectionId: page.collectionId },
    databaseId: database?.collection.id ?? null,
  };
});
