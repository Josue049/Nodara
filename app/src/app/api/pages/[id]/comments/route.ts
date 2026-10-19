import { z } from "zod";
import { broadcastMeta } from "@/server/collab-service";
import { createThread, listThreads } from "@/server/comments-service";
import { api, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

const body = z.object({ body: z.string().trim().min(1).max(5000), anchorText: z.string().max(500).optional(), mentions: z.array(z.uuid()).max(20).optional() });

export const GET = api(async (_req, p, user, db) => listThreads(db, user, z.uuid().parse(p.id)));
export const POST = api(async (req, p, user, db) => {
  const pageId = z.uuid().parse(p.id);
  const out = await createThread(db, user, pageId, body.parse(await readJson(req)));
  broadcastMeta(pageId, { comments: Date.now() }); // quienes tienen la página abierta ven el hilo al instante
  return Response.json(out, { status: 201 });
});
