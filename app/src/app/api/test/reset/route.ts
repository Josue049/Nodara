import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { pages } from "@/server/schema";

export const dynamic = "force-dynamic";

/** Solo para E2E (NODARA_E2E=1): vacía la base para que cada prueba sea independiente. */
export async function POST() {
  if (process.env.NODARA_E2E !== "1") return new NextResponse(null, { status: 404 });
  await (await getDb()).delete(pages);
  return new NextResponse(null, { status: 204 });
}
