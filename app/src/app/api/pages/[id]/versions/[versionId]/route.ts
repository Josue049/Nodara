import { z } from "zod";
import { api } from "@/server/http";
import { getVersion } from "@/server/sharing-service";

export const dynamic = "force-dynamic";

export const GET = api(async (_req, p, user, db) => getVersion(db, user, z.uuid().parse(p.id), z.uuid().parse(p.versionId)));
