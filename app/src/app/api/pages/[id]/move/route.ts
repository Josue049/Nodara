import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/server/db";
import { handleError, readJson } from "@/server/http";
import { movePage } from "@/server/pages-service";

export const dynamic = "force-dynamic";

const moveSchema = z.object({ parentId: z.uuid().nullable(), index: z.number().int().min(0) });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const id = z.uuid().parse((await ctx.params).id);
    const target = moveSchema.parse(await readJson(req));
    return NextResponse.json(await movePage(await getDb(), id, target));
  } catch (e) {
    return handleError(e);
  }
}
