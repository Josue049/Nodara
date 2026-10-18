import { beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "@/server/db";
import {
  createPage,
  deletePagePermanently,
  InvalidMoveError,
  listPages,
  listTrash,
  restorePage,
  trashPage,
  updatePage,
} from "@/server/pages-service";

let db: Db;
beforeEach(async () => {
  db = await createDb("memory://");
});

describe("pages-service", () => {
  it("crea páginas con posición creciente dentro del mismo padre", async () => {
    const a = await createPage(db, { title: "A" });
    const b = await createPage(db, { title: "B" });
    expect(b.position).toBeGreaterThan(a.position);
    const child = await createPage(db, { title: "hija", parentId: a.id });
    expect(child.parentId).toBe(a.id);
  });

  it("actualiza título y favorito", async () => {
    const p = await createPage(db, {});
    const u = await updatePage(db, p.id, { title: "Hola", isFavorite: true });
    expect(u.title).toBe("Hola");
    expect(u.isFavorite).toBe(true);
  });

  it("impide mover una página dentro de su propio subárbol", async () => {
    const a = await createPage(db, { title: "A" });
    const b = await createPage(db, { title: "B", parentId: a.id });
    await expect(updatePage(db, a.id, { parentId: b.id })).rejects.toBeInstanceOf(InvalidMoveError);
    await expect(updatePage(db, a.id, { parentId: a.id })).rejects.toBeInstanceOf(InvalidMoveError);
  });

  it("la papelera incluye descendientes y solo lista la raíz eliminada", async () => {
    const a = await createPage(db, { title: "A" });
    await createPage(db, { title: "B", parentId: a.id });
    await trashPage(db, a.id);
    expect(await listPages(db)).toHaveLength(0);
    const trash = await listTrash(db);
    expect(trash.map((t) => t.title)).toEqual(["A"]);
  });

  it("restaura el subárbol completo", async () => {
    const a = await createPage(db, { title: "A" });
    await createPage(db, { title: "B", parentId: a.id });
    await trashPage(db, a.id);
    await restorePage(db, a.id);
    expect(await listPages(db)).toHaveLength(2);
  });

  it("al restaurar una hija con padre en la papelera pasa a la raíz", async () => {
    const a = await createPage(db, { title: "A" });
    const b = await createPage(db, { title: "B", parentId: a.id });
    await trashPage(db, b.id);
    await trashPage(db, a.id);
    const restored = await restorePage(db, b.id);
    expect(restored.parentId).toBeNull();
  });

  it("solo elimina definitivamente desde la papelera", async () => {
    const a = await createPage(db, { title: "A" });
    await expect(deletePagePermanently(db, a.id)).rejects.toBeInstanceOf(InvalidMoveError);
    await trashPage(db, a.id);
    await deletePagePermanently(db, a.id);
    expect(await listTrash(db)).toHaveLength(0);
  });
});
