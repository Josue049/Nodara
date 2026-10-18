// Uso (desde app/): node --env-file=.env scripts/migrate-pglite-to-postgres.mjs [--force]
import path from "node:path";
import { migratePgliteToPostgres } from "./lib/migrate-data.mjs";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Falta DATABASE_URL (app/.env).");
await migratePgliteToPostgres({
  sourceDir: process.env.NODARA_DATA_DIR || path.resolve(process.cwd(), "..", ".data", "pglite"),
  targetUrl: url,
  backupRoot: path.resolve(process.cwd(), "..", "backups"),
  force: process.argv.includes("--force"),
});
