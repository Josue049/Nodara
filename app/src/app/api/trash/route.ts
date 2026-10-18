import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { handleError } from "@/server/http";
import { listTrash } from "@/server/pages-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await listTrash(await getDb()));
  } catch (e) {
    return handleError(e);
  }
}
