import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { handleError } from "@/server/http";
import { searchPages } from "@/server/pages-service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const results = await searchPages(await getDb(), url.searchParams.get("q") ?? "", {
      titlesOnly: url.searchParams.get("titlesOnly") === "1",
    });
    return NextResponse.json(results);
  } catch (e) {
    return handleError(e);
  }
}
