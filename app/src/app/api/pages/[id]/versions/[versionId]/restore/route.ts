import { z } from "zod";
import { api } from "@/server/http";
import { restoreVersion } from "@/server/sharing-service";

export const dynamic = "force-dynamic";

export const POST = api(async (_req, p, user, db) => {
  await restoreVersion(db, user, z.uuid().parse(p.id), z.uuid().parse(p.versionId));
  return null;
});
