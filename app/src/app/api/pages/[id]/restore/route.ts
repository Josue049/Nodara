import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/server/db";
import { handleError } from "@/server/http";
import { restorePage } from "@/server/pages-service";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const id = z.uuid().parse((await ctx.params).id);
    return NextResponse.json(await restorePage(await getDb(), id));
  } catch (e) {
    return handleError(e);
  }
}
