import { NextResponse } from "next/server";
import { getHandle, isDisposableTarget } from "@/server/db";
import { pages, users, workspaces } from "@/server/schema";

export const dynamic = "force-dynamic";

/**
 * Solo para E2E. Responde 404 salvo que se cumplan TODAS estas condiciones:
 *  1. NODARA_E2E=1 y NODARA_E2E_TOKEN definido (solo lo fija el lanzador de las pruebas, con un valor aleatorio por ejecución);
 *  2. la petición lleva ese token en la cabecera x-nodara-e2e-token;
 *  3. la base de datos es desechable (PGlite en un directorio `e2e`, memoria, o Postgres cuyo nombre acaba en `_test`).
 * Una instalación normal nunca define NODARA_E2E_TOKEN, así que el endpoint no existe para ella.
 */
export async function POST(req: Request) {
  const token = process.env.NODARA_E2E_TOKEN;
  if (process.env.NODARA_E2E !== "1" || !token || req.headers.get("x-nodara-e2e-token") !== token) {
    return new NextResponse(null, { status: 404 });
  }
  const { db, target } = await getHandle();
  if (!isDisposableTarget(target)) return new NextResponse(null, { status: 404 });
  await db.delete(pages);
  await db.delete(workspaces);
  await db.delete(users); // sesiones, miembros, permisos, favoritos e invitaciones caen en cascada
  return new NextResponse(null, { status: 204 });
}
