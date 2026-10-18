import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isDisposableTarget, openDb, type DbHandle } from "@/server/db";
import { createPage, duplicatePage, listPages, movePage, searchPages, trashPage, updatePage } from "@/server/pages-service";

/**
 * Ejercita la ruta de PostgreSQL real (driver `pg` + migrador node-postgres) contra un servidor que habla
 * el protocolo de Postgres (PGlite socket). Con DATABASE_URL_TEST (base *_test) se ejecuta contra un servidor real.
 */
let server: PGLiteSocketServer | null = null;
let handle: DbHandle;

beforeAll(async () => {
  let url = process.env.DATABASE_URL_TEST;
  if (!url) {
    const pg = await PGlite.create();
    server = new PGLiteSocketServer({ db: pg, port: 54329, host: "127.0.0.1" });
    await server.start();
    url = "postgresql://postgres@127.0.0.1:54329/nodara_test";
  }
  handle = await openDb(url);
}, 60_000);

afterAll(async () => {
  await handle?.close();
  await server?.stop();
});

describe("driver PostgreSQL", () => {
  it("aplica migraciones y reconoce la base como desechable (*_test)", () => {
    expect(handle.target.kind).toBe("postgres");
    expect(handle.target.location).toBe("nodara_test");
    expect(isDisposableTarget(handle.target)).toBe(true);
    expect(isDisposableTarget({ kind: "postgres", location: "nodara" })).toBe(false);
    expect(isDisposableTarget({ kind: "pglite", location: "C:/x/.data/pglite" })).toBe(false);
    expect(isDisposableTarget({ kind: "pglite", location: "C:/x/.data/e2e" })).toBe(true);
  });

  it("crea, mueve, duplica, busca y manda a la papelera con transacciones", async () => {
    const { db } = handle;
    const a = await createPage(db, { title: "Presupuesto" });
    const b = await createPage(db, { title: "Hija", parentId: a.id });
    await updatePage(db, a.id, { content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "texto buscable" }] }] } });
    expect((await searchPages(db, "buscable")).map((r) => r.id)).toEqual([a.id]);
    const copy = await duplicatePage(db, a.id);
    expect((await listPages(db)).filter((p) => p.parentId === copy.id)).toHaveLength(1);
    await movePage(db, copy.id, { parentId: null, index: 0 });
    expect((await listPages(db))[0].id).toBe(copy.id);
    await trashPage(db, a.id);
    expect((await listPages(db)).some((p) => p.id === a.id || p.id === b.id)).toBe(false);
  });

  it("una transacción fallida no deja datos a medias", async () => {
    const { db } = handle;
    const before = (await listPages(db)).length;
    await expect(
      db.transaction(async (tx) => {
        await createPage(tx, { title: "no debe persistir" });
        throw new Error("fallo forzado");
      }),
    ).rejects.toThrow("fallo forzado");
    expect(await listPages(db)).toHaveLength(before);
  });
});
