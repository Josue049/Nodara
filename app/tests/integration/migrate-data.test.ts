import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migratePgliteToPostgres } from "../../scripts/lib/migrate-data.mjs";
import { TABLE_ORDER } from "../../scripts/lib/table-order.mjs";
import { openDb } from "@/server/db";
import * as schema from "@/server/schema";
import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { addProperty, addRecord, createDatabase, queryCollection } from "@/server/collections-service";
import { createPage, listPages, updatePage } from "@/server/pages-service";

const tmp = mkdtempSync(path.join(os.tmpdir(), "nodara-mig-"));
let server: ChildProcess;
const url = "postgresql://postgres@127.0.0.1:54330/nodara_test";

beforeAll(async () => {
  server = spawn(process.execPath, [path.join(__dirname, "pg-server.mjs"), "54330"], { stdio: ["ignore", "pipe", "inherit"] });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.stdout!.on("data", (d) => String(d).includes("ready") && resolve());
  });
}, 60_000);
afterAll(() => {
  server.kill();
  rmSync(tmp, { recursive: true, force: true });
});

describe("migración PGlite → PostgreSQL", () => {
  it("TABLE_ORDER cubre todas las tablas del esquema", () => {
    const tables = Object.values(schema).filter((v) => is(v, PgTable)).map((t) => getTableName(t as PgTable));
    expect([...tables].sort()).toEqual([...TABLE_ORDER].sort());
  });

  it("copia páginas con jerarquía, contenido y papelera, con respaldo y sin tocar el origen", async () => {
    const src = path.join(tmp, "src");
    const h = await openDb(src);
    const a = await createPage(h.db, { title: "Raíz", icon: "📘" });
    const b = await createPage(h.db, { title: "Hija", parentId: a.id });
    await updatePage(h.db, b.id, { content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "hola ñandú" }] }] } });
    const database = await createDatabase(h.db, { title: "Tareas" });
    const hours = await addProperty(h.db, database.collection.id, { name: "Horas", type: "number" });
    const rec = await addRecord(h.db, database.collection.id, { title: "Fila", properties: { [hours.id]: 7 } });
    await h.close();

    await migratePgliteToPostgres({ sourceDir: src, targetUrl: url, backupRoot: path.join(tmp, "bk"), log: () => {} });
    expect(readdirSync(path.join(tmp, "bk"))).toHaveLength(1);

    const dst = await openDb(url);
    const rows = await listPages(dst.db);
    expect(rows.map((r) => r.title).sort()).toEqual(["Hija", "Raíz", "Tareas"]);
    const q = await queryCollection(dst.db, database.collection.id); // la base de datos y sus registros sobreviven
    expect(q.rows.map((r) => [r.id, r.title, r.values[hours.id]])).toEqual([[rec.id, "Fila", 7]]);
    expect(q.bundle.views).toHaveLength(1);
    expect(rows.find((r) => r.title === "Hija")!.parentId).toBe(a.id);
    const [full] = (await dst.db.select().from(schema.pages)).filter((p) => p.title === "Hija");
    expect(full.contentText).toBe("hola ñandú");
    await dst.close();

    // segunda ejecución sin --force: aborta para no mezclar datos
    await expect(
      migratePgliteToPostgres({ sourceDir: src, targetUrl: url, backupRoot: path.join(tmp, "bk"), log: () => {} }),
    ).rejects.toThrow(/ya contiene datos/);
  }, 60_000);
});
