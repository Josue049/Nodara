import { z } from "zod";
import { getDb } from "@/server/db";
import { api } from "@/server/http";
import * as C from "@/server/collections-service";

export const dynamic = "force-dynamic";
const uuid = (v: string) => z.uuid().parse(v);

export const GET = api(async (_req, p) => (await C.bundleForPage(await getDb(), uuid(p.id))) ?? Response.json({ error: "La página no es una base de datos" }, { status: 404 }));
