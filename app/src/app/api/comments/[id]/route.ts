import { z } from "zod";
import { broadcastMeta } from "@/server/collab-service";
import { deleteComment, pageIdOfComment, replyToThread, setResolved } from "@/server/comments-service";
import { api, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

const reply = z.object({ body: z.string().trim().min(1).max(5000), mentions: z.array(z.uuid()).max(20).optional() });
const resolve = z.object({ resolved: z.boolean() });

/** POST responde a un hilo (el id es el del comentario raíz). */
export const POST = api(async (req, p, user, db) => {
  const out = await replyToThread(db, user, z.uuid().parse(p.id), reply.parse(await readJson(req)));
  const pageId = await pageIdOfComment(db, out.id);
  if (pageId) broadcastMeta(pageId, { comments: Date.now() });
  return Response.json(out, { status: 201 });
});
export const PATCH = api(async (req, p, user, db) => {
  const id = z.uuid().parse(p.id);
  await setResolved(db, user, id, resolve.parse(await readJson(req)).resolved);
  const pageId = await pageIdOfComment(db, id);
  if (pageId) broadcastMeta(pageId, { comments: Date.now() });
  return null;
});
export const DELETE = api(async (_req, p, user, db) => {
  const out = await deleteComment(db, user, z.uuid().parse(p.id));
  broadcastMeta(out.pageId, { comments: Date.now() });
  return out;
});
