import { z } from "zod";
import { getDb } from "@/server/db";
import { api } from "@/server/http";
import * as C from "@/server/collections-service";

export const dynamic = "force-dynamic";
const uuid = (v: string) => z.uuid().parse(v);

export const POST = api(async (_req, p) => Response.json(await C.duplicateView(await getDb(), uuid(p.id)), { status: 201 }));
