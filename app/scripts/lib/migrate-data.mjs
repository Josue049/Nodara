import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { TABLE_ORDER } from "./table-order.mjs";

const q = (id) => `"${id.replace(/"/g, '""')}"`;

/** Copia los datos de un directorio PGlite a PostgreSQL. Crea respaldo previo, usa una transacción y verifica conteos. */
export async function migratePgliteToPostgres({ sourceDir, targetUrl, backupRoot, force = false, log = console.log }) {
  if (!existsSync(sourceDir)) throw new Error(`No existe el directorio PGlite: ${sourceDir}`);
  mkdirSync(backupRoot, { recursive: true });
  const backup = path.join(backupRoot, `pglite-premigracion-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  cpSync(sourceDir, backup, { recursive: true });
  log(`Respaldo de PGlite: ${backup}`);

  const src = new PGlite(sourceDir);
  await src.waitReady; // la inicialización WASM bloquea el hilo: se completa antes de abrir la conexión
  const pool = new pg.Pool({ connectionString: targetUrl, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: path.join(process.cwd(), "drizzle") });
    const count = async (run, t) => Number((await run(`select count(*)::int as n from ${q(t)}`)).rows[0].n);
    const srcRun = (sql, params) => src.query(sql, params);
    const dstRun = (sql, params) => pool.query(sql, params);

    if (!force) {
      for (const t of TABLE_ORDER) {
        if ((await count(dstRun, t)) > 0) throw new Error(`La tabla '${t}' del destino ya contiene datos. Usa --force para reemplazarlos.`);
      }
    }
    await pool.query("begin");
    try {
      if (force) await pool.query(`truncate ${[...TABLE_ORDER].reverse().map(q).join(", ")} cascade`);
      for (const t of TABLE_ORDER) {
        let rows = (await srcRun(`select * from ${q(t)}`)).rows;
        if (t === "pages") {
          // Padres antes que hijos (clave foránea autorreferenciada).
          const ids = new Set(rows.map((r) => r.id));
          const depth = new Map();
          const byId = new Map(rows.map((r) => [r.id, r]));
          const d = (r) => (depth.has(r.id) ? depth.get(r.id) : (depth.set(r.id, r.parent_id && ids.has(r.parent_id) ? 1 + d(byId.get(r.parent_id)) : 0), depth.get(r.id)));
          rows = rows.sort((a, b) => d(a) - d(b));
        }
        for (const row of rows) {
          const cols = Object.keys(row);
          const vals = cols.map((c) => (row[c] !== null && typeof row[c] === "object" && !(row[c] instanceof Date) ? JSON.stringify(row[c]) : row[c]));
          await pool.query(`insert into ${q(t)} (${cols.map(q).join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")})`, vals);
        }
        const [a, b] = [await count(srcRun, t), await count(dstRun, t)];
        if (a !== b) throw new Error(`Conteo distinto en '${t}': origen ${a}, destino ${b}`);
        log(`  ${t}: ${b} filas copiadas y verificadas`);
      }
      await pool.query("commit");
    } catch (e) {
      await pool.query("rollback");
      throw e;
    }
    log("Migración completada. El directorio PGlite original NO se modificó.");
  } finally {
    await src.close();
    await pool.end();
  }
}
