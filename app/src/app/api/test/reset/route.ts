import { NextResponse } from "next/server";
import { getHandle, isDisposableTarget } from "@/server/db";
import { pages } from "@/server/schema";

export const dynamic = "force-dynamic";

/**
 * Solo para E2E. Responde 404 salvo que se cumplan TODAS estas condiciones:
 * NODARA_E2E=1, NODE_ENV distinto de production y base de datos desechable
 * (PGlite en un directorio `e2e`, memoria, o Postgres cuyo nombre acaba en `_test`).
 */
export async function POST() {
  if (process.env.NODARA_E2E !== "1" || process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }
  const { db, target } = await getHandle();
  if (!isDisposableTarget(target)) return new NextResponse(null, { status: 404 });
  await db.delete(pages);
  return new NextResponse(null, { status: 204 });
}
