import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { CollectionError, CollectionNotFound } from "./collections-service";
import { InvalidMoveError, NotFoundError } from "./pages-service";

export function handleError(err: unknown) {
  if (err instanceof ZodError) {
    return NextResponse.json({ error: "Datos no válidos", issues: err.issues }, { status: 400 });
  }
  if (err instanceof CollectionError) return NextResponse.json({ error: err.message }, { status: 400 });
  if (err instanceof CollectionNotFound) return NextResponse.json({ error: err.message }, { status: 404 });
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

type Ctx = { params: Promise<Record<string, string>> };

/** Envuelve un manejador: valida/serializa y traduce errores del dominio a respuestas HTTP. */
export function api(handler: (req: Request, params: Record<string, string>) => Promise<unknown>) {
  return async (req: Request, ctx: Ctx) => {
    try {
      const out = await handler(req, await ctx.params);
      if (out instanceof Response) return out;
      return out === null || out === undefined ? new NextResponse(null, { status: 204 }) : NextResponse.json(out);
    } catch (e) {
      return handleError(e);
    }
  };
}
