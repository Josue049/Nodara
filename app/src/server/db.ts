import { mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";

export type Db = PgliteDatabase<typeof schema>;

/**
 * Postgres embebido (PGlite) persistido en disco. Sin Docker ni servicio externo.
 * Por defecto vive en <repo>/.data, fuera de la raíz vigilada por Next (si no, cada escritura
 * dispara recargas de HMR). NODARA_DATA_DIR="memory://" usa una base efímera (tests).
 */
export async function createDb(dataDir: string): Promise<Db> {
  if (!dataDir.startsWith("memory://")) mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db;
}

const g = globalThis as unknown as { __nodaraDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  g.__nodaraDb ??= createDb(
    process.env.NODARA_DATA_DIR ?? path.resolve(process.cwd(), "..", ".data", "pglite"),
  );
  return g.__nodaraDb;
}
