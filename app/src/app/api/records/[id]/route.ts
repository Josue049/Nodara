import { z } from "zod";
import { getDb } from "@/server/db";
import { api, readJson } from "@/server/http";
import * as C from "@/server/collections-service";
import * as V from "@/server/validation";

import { eq } from "drizzle-orm";
import { pages } from "@/server/schema";

export const dynamic = "force-dynamic";
const uuid = (v: string) => z.uuid().parse(v);

/** Registro como página: datos de la página, definición de su base y valores calculados. */
export const GET = api(async (_req, p) => {
  const db = await getDb();
  const id = uuid(p.id);
  const [page] = await db.select().from(pages).where(eq(pages.id, id));
  if (!page?.collectionId) return Response.json({ error: "Registro no encontrado" }, { status: 404 });
  const q = await C.queryCollection(db, page.collectionId, { config: {} });
  return { page, bundle: q.bundle, row: q.rows.find((r) => r.id === id) ?? null, refs: q.refs ?? {} };
});
export const PATCH = api(async (req, p) => C.updateRecord(await getDb(), uuid(p.id), V.updateRecordSchema.parse(await readJson(req))));
