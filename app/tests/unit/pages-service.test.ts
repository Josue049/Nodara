import { beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "@/server/db";
import {
  createPage,
  deletePagePermanently,
  duplicatePage,
  extractText,
  movePage,
  searchPages,
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

  it("mueve y reordena entre hermanas", async () => {
    const a = await createPage(db, { title: "A" });
    const b = await createPage(db, { title: "B" });
    const c = await createPage(db, { title: "C" });
    await movePage(db, c.id, { parentId: null, index: 0 });
    expect((await listPages(db)).map((p) => p.title)).toEqual(["C", "A", "B"]);
    await movePage(db, a.id, { parentId: null, index: 99 });
    expect((await listPages(db)).map((p) => p.title)).toEqual(["C", "B", "A"]);
    await movePage(db, b.id, { parentId: null, index: 1 });
    expect((await listPages(db)).map((p) => p.title)).toEqual(["C", "B", "A"]);
    const moved = await movePage(db, b.id, { parentId: a.id, index: 0 });
    expect(moved.parentId).toBe(a.id);
    await expect(movePage(db, a.id, { parentId: b.id, index: 0 })).rejects.toBeInstanceOf(InvalidMoveError);
  });

  it("duplica el subárbol justo después de la original", async () => {
    const a = await createPage(db, { title: "A" });
    await createPage(db, { title: "Z" });
    const child = await createPage(db, { title: "hija", parentId: a.id });
    await createPage(db, { title: "nieta", parentId: child.id });
    const copy = await duplicatePage(db, a.id);
    const all = await listPages(db);
    expect(all).toHaveLength(7);
    expect(all.filter((p) => !p.parentId).map((p) => p.title)).toEqual(["A", "A", "Z"]);
    expect(all.filter((p) => p.parentId === copy.id)).toHaveLength(1);
    expect(copy.id).not.toBe(a.id);
  });

  it("extrae texto y busca por título y contenido sin distinguir acentos", async () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Reunión de equipo" }] }, { type: "paragraph", content: [{ type: "text", text: "presupuesto anual" }] }] };
    expect(extractText(doc)).toBe("Reunión de equipo presupuesto anual");
    const a = await createPage(db, { title: "Notas" });
    await updatePage(db, a.id, { content: doc });
    await createPage(db, { title: "Presupuesto 2026" });
    const hits = await searchPages(db, "presupuesto");
    expect(hits.map((h) => h.title)).toEqual(["Presupuesto 2026", "Notas"]); // título primero
    expect(hits[1].snippet).toContain("presupuesto anual");
    expect((await searchPages(db, "reunion")).map((h) => h.title)).toEqual(["Notas"]);
    expect(await searchPages(db, "reunion", { titlesOnly: true })).toHaveLength(0);
  });
});
