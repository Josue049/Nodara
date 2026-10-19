import { beforeEach, describe, expect, it } from "vitest";
import {
  addOption,
  addProperty,
  addRecord,
  bundleForPage,
  CollectionError,
  createDatabase,
  createTemplate,
  createView,
  deleteProperty,
  deleteView,
  duplicateView,
  getBundle,
  queryCollection,
  updateProperty,
  updateRecord,
  updateView,
} from "@/server/collections-service";
import { createDb, type Db } from "@/server/db";
import { createPage, duplicatePage, listPages, searchPages } from "@/server/pages-service";

let db: Db;
beforeEach(async () => {
  db = await createDb("memory://");
});

async function tasksDb() {
  const { collection, views } = await createDatabase(db, { title: "Tareas" });
  const status = await addProperty(db, collection.id, { name: "Estado", type: "status" });
  const hours = await addProperty(db, collection.id, { name: "Horas", type: "number" });
  const due = await addProperty(db, collection.id, { name: "Vence", type: "date" });
  return { cid: collection.id, view: views[0], status, hours, due };
}

describe("bases de datos: creación y propiedades", () => {
  it("crea una base de página completa con vista de tabla y la oculta del árbol de páginas", async () => {
    const { collection, views, page } = await createDatabase(db, { title: "Proyectos" });
    expect(page.kind).toBe("database");
    expect(views).toHaveLength(1);
    expect(views[0].type).toBe("table");
    expect((await bundleForPage(db, page.id))!.collection.id).toBe(collection.id);
    await addRecord(db, collection.id, { title: "Fila 1" });
    const tree = await listPages(db);
    expect(tree.map((p) => p.title)).toEqual(["Proyectos"]); // los registros no salen en la barra lateral
    expect(tree[0].kind).toBe("database");
  });

  it("estado trae opciones por defecto; select acepta opciones nuevas; nombres únicos", async () => {
    const { cid, status } = await tasksDb();
    expect(status.config.options!.map((o) => o.name)).toEqual(["Sin empezar", "En curso", "Listo"]);
    const tag = await addProperty(db, cid, { name: "Etiqueta", type: "select" });
    const { option, property } = await addOption(db, tag.id, { name: "Urgente" });
    expect(property.config.options).toHaveLength(1);
    expect((await addOption(db, tag.id, { name: "urgente" })).option.id).toBe(option.id); // sin duplicados
    await expect(addProperty(db, cid, { name: "horas", type: "text" })).rejects.toBeInstanceOf(CollectionError);
  });

  it("valida fórmulas al crear y editar", async () => {
    const { cid } = await tasksDb();
    await expect(addProperty(db, cid, { name: "F", type: "formula", config: { expression: 'prop("Nada") + 1' } })).rejects.toThrow(/Propiedad desconocida/);
    await expect(addProperty(db, cid, { name: "F", type: "formula", config: { expression: "1 +" } })).rejects.toBeInstanceOf(CollectionError);
    const ok = await addProperty(db, cid, { name: "Doble", type: "formula", config: { expression: 'prop("Horas") * 2' } });
    await expect(updateProperty(db, ok.id, { config: { expression: "((" } })).rejects.toBeInstanceOf(CollectionError);
  });
});

describe("registros", () => {
  it("valida valores por tipo y rechaza propiedades calculadas", async () => {
    const { cid, status, hours, due } = await tasksDb();
    const f = await addProperty(db, cid, { name: "Doble", type: "formula", config: { expression: 'prop("Horas") * 2' } });
    const r = await addRecord(db, cid, { title: "A", properties: { [hours.id]: 4, [status.id]: "doing", [due.id]: { start: "2026-10-20" } } });
    expect(r.properties).toMatchObject({ [hours.id]: 4, [status.id]: "doing" });
    await expect(updateRecord(db, r.id, { properties: { [hours.id]: "mucho" } })).rejects.toBeInstanceOf(CollectionError);
    await expect(updateRecord(db, r.id, { properties: { [status.id]: "inventado" } })).rejects.toBeInstanceOf(CollectionError);
    await expect(updateRecord(db, r.id, { properties: { [due.id]: { start: "no-fecha" } } })).rejects.toBeInstanceOf(CollectionError);
    await expect(updateRecord(db, r.id, { properties: { [f.id]: 5 } })).rejects.toThrow(/se calcula/);
    await expect(updateRecord(db, r.id, { properties: { zzz: 1 } })).rejects.toThrow(/desconocida/);
    const u = await updateRecord(db, r.id, { title: "A2", properties: { [hours.id]: 6 } });
    expect(u.title).toBe("A2");
    expect(u.properties).toMatchObject({ [hours.id]: 6, [status.id]: "doing" }); // fusiona, no reemplaza
  });

  it("consulta con vista guardada: filtros, orden y fórmula calculada", async () => {
    const { cid, view, status, hours } = await tasksDb();
    const f = await addProperty(db, cid, { name: "Doble", type: "formula", config: { expression: 'prop("Horas") * 2' } });
    await addRecord(db, cid, { title: "B", properties: { [hours.id]: 2, [status.id]: "done" } });
    await addRecord(db, cid, { title: "A", properties: { [hours.id]: 5, [status.id]: "todo" } });
    await updateView(db, view.id, {
      config: { sorts: [{ propertyId: hours.id, direction: "desc" }], filter: { op: "and", conditions: [{ propertyId: status.id, operator: "is_not", value: "done" }] } },
    });
    const r = await queryCollection(db, cid, { viewId: view.id });
    expect(r.rows.map((x) => x.title)).toEqual(["A"]);
    expect(r.rows[0].values[f.id]).toBe(10);
    expect(r.total).toBe(2);
    const all = await queryCollection(db, cid, { config: { sorts: [{ propertyId: hours.id, direction: "desc" }] }, search: "a" });
    expect(all.rows.map((x) => x.title)).toEqual(["A"]);
  });

  it("registros en la papelera dejan de aparecer en la consulta", async () => {
    const { cid } = await tasksDb();
    const r = await addRecord(db, cid, { title: "X" });
    const { trashPage } = await import("@/server/pages-service");
    await trashPage(db, r.id);
    expect((await queryCollection(db, cid)).rows).toHaveLength(0);
  });
});

describe("relaciones y rollups", () => {
  it("relación bidireccional se mantiene sincronizada y el rollup suma", async () => {
    const proj = await createDatabase(db, { title: "Proyectos" });
    const budget = await addProperty(db, proj.collection.id, { name: "Presupuesto", type: "number" });
    const p1 = await addRecord(db, proj.collection.id, { title: "Alfa", properties: { [budget.id]: 100 } });
    const p2 = await addRecord(db, proj.collection.id, { title: "Beta", properties: { [budget.id]: 50 } });

    const tasks = await createDatabase(db, { title: "Tareas" });
    const rel = await addProperty(db, tasks.collection.id, {
      name: "Proyecto",
      type: "relation",
      config: { relationCollectionId: proj.collection.id },
      bidirectional: true,
    });
    expect(rel.config.reciprocalPropertyId).toBeTruthy();
    const roll = await addProperty(db, tasks.collection.id, {
      name: "Total",
      type: "rollup",
      config: { rollupRelationId: rel.id, rollupTargetId: budget.id, rollupFn: "sum" },
    });
    const t = await addRecord(db, tasks.collection.id, { title: "T1", properties: { [rel.id]: [p1.id, p2.id] } });

    const projQ = await queryCollection(db, proj.collection.id);
    const recip = rel.config.reciprocalPropertyId!;
    expect(projQ.rows.find((r) => r.id === p1.id)!.values[recip]).toEqual([t.id]);
    expect((await queryCollection(db, tasks.collection.id)).rows[0].values[roll.id]).toBe(150);

    await updateRecord(db, t.id, { properties: { [rel.id]: [p2.id] } }); // quita p1
    expect((await queryCollection(db, proj.collection.id)).rows.find((r) => r.id === p1.id)!.values[recip]).toEqual([]);
    expect((await queryCollection(db, tasks.collection.id)).rows[0].values[roll.id]).toBe(50);

    await deleteProperty(db, rel.id); // elimina recíproca y rollup dependiente
    expect((await getBundle(db, proj.collection.id)).properties.map((p) => p.name)).toEqual(["Presupuesto"]);
    expect((await getBundle(db, tasks.collection.id)).properties).toHaveLength(0);
  });
});

describe("vistas y plantillas", () => {
  it("crea vistas con valores por defecto, duplica y no permite borrar la última", async () => {
    const { cid, view, status, due } = await tasksDb();
    const board = await createView(db, cid, { type: "board" });
    expect(board.config.group?.propertyId).toBe(status.id);
    const cal = await createView(db, cid, { type: "calendar" });
    expect(cal.config.dateProperty).toBe(due.id);
    const copy = await duplicateView(db, board.id);
    expect(copy.name).toBe("Tablero (copia)");
    expect((await getBundle(db, cid)).views).toHaveLength(4);
    await deleteView(db, copy.id);
    await deleteView(db, board.id);
    await deleteView(db, cal.id);
    await expect(deleteView(db, view.id)).rejects.toThrow(/al menos una vista/);
  });

  it("plantillas aplican título, valores y contenido a registros nuevos", async () => {
    const { cid, status, hours } = await tasksDb();
    const content = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Pasos de la plantilla" }] }] };
    const t = await createTemplate(db, cid, { name: "Informe", title: "Informe semanal", properties: { [status.id]: "doing", [hours.id]: 2 }, content });
    const r = await addRecord(db, cid, { templateId: t.id });
    expect(r.title).toBe("Informe semanal");
    expect(r.properties).toMatchObject({ [status.id]: "doing", [hours.id]: 2 });
    expect(r.content).toEqual(content);
    const o = await addRecord(db, cid, { templateId: t.id, title: "Otro", properties: { [hours.id]: 9 } });
    expect(o.title).toBe("Otro");
    expect(o.properties).toMatchObject({ [hours.id]: 9 });
  });
});

describe("duplicar páginas con bases de datos", () => {
  it("clona la base, sus registros y reescribe ids; editar la copia no afecta al original", async () => {
    const host = await createPage(db, { title: "Panel" });
    const { collection, views } = await createDatabase(db, { hostPageId: host.id, title: "Tareas internas" });
    const hours = await addProperty(db, collection.id, { name: "Horas", type: "number" });
    await updateView(db, views[0].id, { config: { sorts: [{ propertyId: hours.id, direction: "asc" }] } });
    const rec = await addRecord(db, collection.id, { title: "Uno", properties: { [hours.id]: 3 } });
    const { updatePage } = await import("@/server/pages-service");
    await updatePage(db, host.id, { content: { type: "doc", content: [{ type: "databaseBlock", attrs: { collectionId: collection.id } }] } });

    const copy = await duplicatePage(db, host.id);
    const [copied] = (await db.query.pages.findMany({ where: (p, { eq }) => eq(p.id, copy.id) }));
    const newCollectionId = (copied.content as { content: { attrs: { collectionId: string } }[] }).content[0].attrs.collectionId;
    expect(newCollectionId).not.toBe(collection.id);

    const nb = await getBundle(db, newCollectionId);
    expect(nb.collection.hostPageId).toBe(copy.id);
    expect(nb.properties.map((p) => p.name)).toEqual(["Horas"]);
    expect(nb.properties[0].id).not.toBe(hours.id);
    expect(nb.views[0].config.sorts![0].propertyId).toBe(nb.properties[0].id); // vistas reapuntadas
    const q = await queryCollection(db, newCollectionId);
    expect(q.rows).toHaveLength(1);
    expect(q.rows[0].values[nb.properties[0].id]).toBe(3);
    expect(q.rows[0].id).not.toBe(rec.id);

    await updateRecord(db, q.rows[0].id, { properties: { [nb.properties[0].id]: 99 } });
    expect((await queryCollection(db, collection.id)).rows[0].values[hours.id]).toBe(3); // el original no cambió
  });

  it("la búsqueda de páginas encuentra registros de bases de datos por título", async () => {
    const { cid } = await tasksDb();
    await addRecord(db, cid, { title: "Informe trimestral" });
    expect((await searchPages(db, "trimestral")).map((r) => r.title)).toEqual(["Informe trimestral"]);
  });
});
