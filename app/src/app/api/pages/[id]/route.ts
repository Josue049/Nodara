import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/server/db";
import { handleError, readJson } from "@/server/http";
import { deletePagePermanently, getPage, trashPage, updatePage } from "@/server/pages-service";
import { updatePageSchema } from "@/server/validation";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

async function pageId(ctx: Ctx) {
  return z.uuid().parse((await ctx.params).id);
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    return NextResponse.json(await getPage(await getDb(), await pageId(ctx)));
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const patch = updatePageSchema.parse(await readJson(req));
    return NextResponse.json(await updatePage(await getDb(), await pageId(ctx), patch));
  } catch (e) {
    return handleError(e);
  }
}

/** Sin parámetros envía a la papelera; con ?permanent=1 elimina definitivamente (solo desde la papelera). */
export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const db = await getDb();
    const id = await pageId(ctx);
    if (new URL(req.url).searchParams.get("permanent") === "1") await deletePagePermanently(db, id);
    else await trashPage(db, id);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return handleError(e);
  }
}
