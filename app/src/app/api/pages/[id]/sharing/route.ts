import { z } from "zod";
import { api } from "@/server/http";
import { sharingInfo } from "@/server/sharing-service";

export const dynamic = "force-dynamic";

export const GET = api(async (_req, p, user, db) => sharingInfo(db, user, z.uuid().parse(p.id)));
