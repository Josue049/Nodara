import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { assertSameOrigin, currentUser, HttpError, readCookie, type SessionUser } from "./auth";
import { memberRole } from "./authz";
import { CollectionError, CollectionNotFound } from "./collections-service";
import { getDb, type Db } from "./db";
import { InvalidMoveError, NotFoundError } from "./pages-service";

export const WORKSPACE_COOKIE = "nodara_ws";

export function handleError(err: unknown) {
  if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
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
type Params = Record<string, string>;

function wrap(handler: (req: Request, params: Params, user: SessionUser | null, db: Db) => Promise<unknown>, requireUser: boolean) {
  return async (req: Request, ctx: Ctx) => {
    try {
      assertSameOrigin(req);
      const db = await getDb();
      const user = await currentUser(db, req);
      if (requireUser && !user) throw new HttpError(401, "Inicia sesión para continuar");
      const out = await handler(req, await ctx.params, user, db);
      if (out instanceof Response) return out;
      return out === null || out === undefined ? new NextResponse(null, { status: 204 }) : NextResponse.json(out);
    } catch (e) {
      return handleError(e);
    }
  };
}

/** Manejador que exige una sesión válida. Recibe el usuario y la base de datos ya resueltos. */
export function api(handler: (req: Request, params: Params, user: SessionUser, db: Db) => Promise<unknown>) {
  return wrap((req, params, user, db) => handler(req, params, user!, db), true);
}

/** Manejador accesible sin sesión (autenticación, enlaces públicos). */
export function publicApi(handler: (req: Request, params: Params, user: SessionUser | null, db: Db) => Promise<unknown>) {
  return wrap(handler, false);
}

/** Espacio de trabajo activo: el indicado, el de la cookie (si pertenece al usuario) o el primero. */
export async function resolveWorkspace(db: Db, user: SessionUser, req: Request, explicit?: string | null): Promise<string> {
  const candidates = [explicit, readCookie(req, WORKSPACE_COOKIE)].filter((x): x is string => !!x);
  for (const id of candidates) {
    if (/^[0-9a-f-]{36}$/.test(id) && (await memberRole(db, user.id, id))) return id;
    if (id === explicit) throw new HttpError(404, "Espacio de trabajo no encontrado");
  }
  const { listWorkspaces } = await import("./workspaces-service");
  const first = (await listWorkspaces(db, user.id))[0];
  if (!first) throw new HttpError(404, "No perteneces a ningún espacio de trabajo");
  return first.id;
}
