import { z } from "zod";
import { api, readJson } from "@/server/http";
import { setPermission } from "@/server/sharing-service";
import { permissionSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

export const PATCH = api(async (req, p, user, db) => {
  const { level } = permissionSchema.parse(await readJson(req));
  await setPermission(db, user, z.uuid().parse(p.id), z.uuid().parse(p.userId), level as Parameters<typeof setPermission>[4]);
  return null;
});
export const DELETE = api(async (_req, p, user, db) => {
  await setPermission(db, user, z.uuid().parse(p.id), z.uuid().parse(p.userId), null);
  return null;
});
