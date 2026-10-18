import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { InvalidMoveError, NotFoundError } from "./pages-service";

export function handleError(err: unknown) {
  if (err instanceof ZodError) {
    return NextResponse.json({ error: "Datos no válidos", issues: err.issues }, { status: 400 });
  }
  if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
  if (err instanceof InvalidMoveError) return NextResponse.json({ error: err.message }, { status: 409 });
  console.error(err);
  return NextResponse.json({ error: "Error interno" }, { status: 500 });
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}
