import { z } from "zod";
import { pageAnalytics, recordView } from "@/server/analytics-service";
import { assertPage } from "@/server/authz";
import { api } from "@/server/http";

export const dynamic = "force-dynamic";

/** Registra una visita de la persona actual (una por día se acumula en el contador). */
export const POST = api(async (_req, p, user, db) => {
  const id = z.uuid().parse(p.id);
  await assertPage(db, user, id, "view");
  await recordView(db, user.id, id);
  return null;
});

/** Estadísticas de la página: solo quien puede editarla. */
export const GET = api(async (_req, p, user, db) => {
  const id = z.uuid().parse(p.id);
  await assertPage(db, user, id, "edit");
  return pageAnalytics(db, id);
});
