import { z } from "zod";
import { deleteComment, replyToThread, setResolved } from "@/server/comments-service";
import { api, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

const reply = z.object({ body: z.string().trim().min(1).max(5000), mentions: z.array(z.uuid()).max(20).optional() });
const resolve = z.object({ resolved: z.boolean() });

/** POST responde a un hilo (el id es el del comentario raíz). */
export const POST = api(async (req, p, user, db) => Response.json(await replyToThread(db, user, z.uuid().parse(p.id), reply.parse(await readJson(req))), { status: 201 }));
export const PATCH = api(async (req, p, user, db) => {
  await setResolved(db, user, z.uuid().parse(p.id), resolve.parse(await readJson(req)).resolved);
  return null;
});
export const DELETE = api(async (_req, p, user, db) => deleteComment(db, user, z.uuid().parse(p.id)));
