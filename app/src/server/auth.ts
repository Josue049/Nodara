import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import type { Db } from "./db";
import { sessions, users } from "./schema";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number }) => Promise<Buffer>;

export const SESSION_COOKIE = "nodara_session";
export const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;
const SCRYPT = { N: 16384, r: 8, p: 1 } as const;

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export type SessionUser = { id: string; email: string; name: string; avatarColor: string; isGuest?: boolean };

// ── Contraseñas ──────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 32, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scrypt(password, Buffer.from(salt, "base64"), expected.length, { N: Number(n), r: Number(r), p: Number(p) });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Contraseña ficticia para igualar el tiempo de respuesta cuando el correo no existe.
let dummyHash: Promise<string> | null = null;
export const dummyVerify = async (password: string) => {
  dummyHash ??= hashPassword("nodara-dummy-password");
  await verifyPassword(password, await dummyHash);
};

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");

// ── Sesiones ─────────────────────────────────────────────────────────

export async function createSession(db: Db, userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ userId, tokenHash: sha256(token), expiresAt });
  // Limpieza oportunista de sesiones caducadas.
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  return { token, expiresAt };
}

export async function destroySession(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
}

export async function userForToken(db: Db, token: string): Promise<SessionUser | null> {
  const [row] = await db
    .select({ id: users.id, email: users.email, name: users.name, avatarColor: users.avatarColor, isGuest: users.isGuest, sessionId: sessions.id, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date())));
  if (!row) return null;
  // Sesión deslizante: si queda menos de la mitad del tiempo, se renueva.
  if (row.expiresAt.getTime() - Date.now() < SESSION_TTL_MS / 2) {
    await db.update(sessions).set({ expiresAt: new Date(Date.now() + SESSION_TTL_MS) }).where(eq(sessions.id, row.sessionId));
  }
  return { id: row.id, email: row.email, name: row.name, avatarColor: row.avatarColor, isGuest: row.isGuest };
}

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

export function sessionCookie(req: Request, token: string, expiresAt: Date): string {
  const secure = process.env.NODARA_COOKIE_SECURE === "1" || new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}${secure ? "; Secure" : ""}`;
}

export const clearedSessionCookie = () => `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

export async function currentUser(db: Db, req: Request): Promise<SessionUser | null> {
  const token = readCookie(req, SESSION_COOKIE);
  return token ? userForToken(db, token) : null;
}

// ── Protección ───────────────────────────────────────────────────────

/** Rechaza peticiones que modifican datos desde otro origen (CSRF). Las llamadas sin cabecera Origin (no navegador) pasan. */
export function assertSameOrigin(req: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {}
  if (!host || originHost !== host) throw new HttpError(403, "Origen no permitido");
}

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** Limitador de intentos en memoria (ventana fija). Lanza 429 al superar el máximo. */
export function rateLimit(key: string, max: number, windowMs: number): void {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (++b.count > max) throw new HttpError(429, "Demasiados intentos. Inténtalo de nuevo más tarde.");
}
export const resetRateLimit = (key: string) => buckets.delete(key);
export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";

export async function countUsers(db: Db): Promise<number> {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(users);
  return r.n;
}
