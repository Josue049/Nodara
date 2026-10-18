import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { handleError, readJson } from "@/server/http";
import { createPage, listPages } from "@/server/pages-service";
import { createPageSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await listPages(await getDb()));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const input = createPageSchema.parse(await readJson(req));
    return NextResponse.json(await createPage(await getDb(), input), { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
