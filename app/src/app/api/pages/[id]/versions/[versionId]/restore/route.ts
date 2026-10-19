import { z } from "zod";
import { auditPage } from "@/server/audit-service";
import { api } from "@/server/http";
import { invalidateRoom } from "@/server/collab-service";
import { restoreVersion } from "@/server/sharing-service";

export const dynamic = "force-dynamic";

export const POST = api(async (_req, p, user, db) => {
  const id = z.uuid().parse(p.id);
  await restoreVersion(db, user, id, z.uuid().parse(p.versionId));
  await invalidateRoom(db, id);
  await auditPage(db, user, id, "page.restore_version", String(p.versionId));
  return null;
});
