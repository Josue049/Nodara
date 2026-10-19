import { z } from "zod";
import { createThread, listThreads } from "@/server/comments-service";
import { api, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

const body = z.object({ body: z.string().trim().min(1).max(5000), anchorText: z.string().max(500).optional(), mentions: z.array(z.uuid()).max(20).optional() });

export const GET = api(async (_req, p, user, db) => listThreads(db, user, z.uuid().parse(p.id)));
export const POST = api(async (req, p, user, db) => Response.json(await createThread(db, user, z.uuid().parse(p.id), body.parse(await readJson(req))), { status: 201 }));
