import { z } from "zod";
import { api } from "@/server/http";
import { listVersions } from "@/server/sharing-service";

export const dynamic = "force-dynamic";

export const GET = api(async (_req, p, user, db) => listVersions(db, user, z.uuid().parse(p.id)));
