import { mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { Pool } from "pg";
import * as schema from "./schema";

/** Base de datos Drizzle sobre Postgres (servidor real o PGlite): mismo dialecto y mismas migraciones. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export type DbTarget = {
  kind: "postgres" | "pglite";
  /** Nombre de la base (Postgres) o ruta de datos (PGlite). Nunca incluye credenciales. */
  location: string;
};

export type DbHandle = { db: Db; target: DbTarget; close: () => Promise<void> };

const isPostgresUrl = (s: string) => /^postgres(ql)?:\/\//i.test(s);

/**
 * Abre la base y aplica las migraciones pendientes.
 * - `postgresql://…` → servidor PostgreSQL (producción y desarrollo).
 * - ruta de directorio → PGlite embebido (sin servidor; tests y arranque rápido).
 * - `memory://` → PGlite efímero.
 */
export async function openDb(location: string): Promise<DbHandle> {
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  if (isPostgresUrl(location)) {
    const pool = new Pool({ connectionString: location, max: 10 });
    const db = drizzlePg(pool, { schema }) as unknown as Db;
    await migratePg(drizzlePg(pool), { migrationsFolder });
    const name = decodeURIComponent(new URL(location).pathname.replace(/^\//, ""));
    return { db, target: { kind: "postgres", location: name }, close: () => pool.end() };
  }
  if (!location.startsWith("memory://")) mkdirSync(location, { recursive: true });
  const client = new PGlite(location);
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder });
  return { db: db as unknown as Db, target: { kind: "pglite", location }, close: () => client.close() };
}

/** Compatibilidad con pruebas existentes: devuelve solo la base. */
export async function createDb(location: string): Promise<Db> {
  return (await openDb(location)).db;
}

/**
 * Ubicación configurada: DATABASE_URL (PostgreSQL) o, si no existe, PGlite en <repo>/.data/pglite
 * (fuera de la raíz vigilada por Next; si no, cada escritura dispara recargas de HMR).
 * NODARA_DATA_DIR="memory://" usa una base efímera.
 */
export function configuredLocation(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (url) return url;
  return process.env.NODARA_DATA_DIR ?? path.resolve(process.cwd(), "..", ".data", "pglite");
}

const g = globalThis as unknown as { __nodaraDb?: Promise<DbHandle> };

export function getHandle(): Promise<DbHandle> {
  g.__nodaraDb ??= openDb(configuredLocation());
  return g.__nodaraDb;
}

export async function getDb(): Promise<Db> {
  return (await getHandle()).db;
}

/**
 * Solo una base desechable de pruebas puede vaciarse: PGlite en un directorio `e2e`,
 * memoria, o una base Postgres cuyo nombre termina en `_test`.
 */
export function isDisposableTarget(t: DbTarget): boolean {
  if (t.kind === "postgres") return /_test$/i.test(t.location);
  return t.location.startsWith("memory://") || path.normalize(t.location).split(path.sep).includes("e2e");
}
