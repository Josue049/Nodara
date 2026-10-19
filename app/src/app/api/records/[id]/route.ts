import { z } from "zod";
import { assertPage } from "@/server/authz";
import { queryCollection, updateRecord } from "@/server/collections-service";
import { api, readJson } from "@/server/http";
import { getPage } from "@/server/pages-service";
import { updateRecordSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

const rid = (v: string) => z.uuid().parse(v);

/** Registro como página: datos de la página, definición de su base y valores calculados. */
export const GET = api(async (_req, p, user, db) => {
  const id = rid(p.id);
  await assertPage(db, user, id, "view");
  const page = await getPage(db, id);
  if (!page.collectionId) return Response.json({ error: "Registro no encontrado" }, { status: 404 });
  const q = await queryCollection(db, page.collectionId, { config: {} });
  return { page, bundle: q.bundle, row: q.rows.find((r) => r.id === id) ?? null, refs: q.refs ?? {} };
});
export const PATCH = api(async (req, p, user, db) => {
  const id = rid(p.id);
  await assertPage(db, user, id, "edit");
  return updateRecord(db, id, updateRecordSchema.parse(await readJson(req)));
});
