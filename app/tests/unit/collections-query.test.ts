import { describe, expect, it } from "vitest";
import { runQuery, type CollectionData, type StoredRecord, type World } from "@/lib/collections/query";
import { TITLE_ID, type PropertyDef, type ViewConfig } from "@/lib/collections/types";

const P = (id: string, type: PropertyDef["type"], name: string, config: PropertyDef["config"] = {}, collectionId = "c1"): PropertyDef => ({
  id,
  collectionId,
  name,
  type,
  config,
  position: 0,
});
const R = (id: string, title: string, properties: Record<string, unknown>, n = 0): StoredRecord => ({
  id,
  title,
  icon: null,
  createdAt: new Date(2026, 0, 1 + n),
  updatedAt: new Date(2026, 0, 1 + n),
  properties,
});

const statusOpts = [
  { id: "todo", name: "Sin empezar", color: "gray" as const, group: "todo" as const },
  { id: "doing", name: "En curso", color: "blue" as const, group: "in_progress" as const },
  { id: "done", name: "Listo", color: "green" as const, group: "done" as const },
];
const tagOpts = [
  { id: "t1", name: "Urgente", color: "red" as const },
  { id: "t2", name: "Casa", color: "green" as const },
];

const tasks: CollectionData = {
  props: [
    P("st", "status", "Estado", { options: statusOpts }),
    P("n", "number", "Horas"),
    P("tg", "multi_select", "Etiquetas", { options: tagOpts }),
    P("d", "date", "Vence"),
    P("ok", "checkbox", "Hecha"),
    P("f", "formula", "Costo", { expression: 'prop("Horas") * 10' }),
    P("proj", "relation", "Proyecto", { relationCollectionId: "c2" }),
    P("rl", "rollup", "Presupuesto", { rollupRelationId: "proj", rollupTargetId: "budget", rollupFn: "sum" }),
  ],
  records: [
    R("a", "Escribir informe", { st: "doing", n: 3, tg: ["t1"], d: { start: "2026-10-20" }, ok: false, proj: ["p1"] }, 0),
    R("b", "Comprar café", { st: "todo", n: 1, tg: ["t2"], d: { start: "2026-10-18" }, ok: true, proj: [] }, 1),
    R("c", "Revisar código", { st: "done", n: 5, tg: ["t1", "t2"], ok: true, proj: ["p1", "p2"] }, 2),
    R("d", "Ñandú", { n: null }, 3),
  ],
};
const projects: CollectionData = {
  props: [P("budget", "number", "Presupuesto", {}, "c2")],
  records: [R("p1", "Alfa", { budget: 100 }), R("p2", "Beta", { budget: 50 })],
};
const world: World = (id) => ({ c1: tasks, c2: projects })[id];
const now = () => new Date("2026-10-18T10:00:00Z");
const q = (config: ViewConfig, search?: string) => runQuery("c1", world, config, { now, search });
const titles = (r: ReturnType<typeof q>) => r.rows.map((x) => x.title);

describe("consulta de colecciones", () => {
  it("calcula fórmulas y rollups sobre relaciones", () => {
    const rows = q({}).rows;
    expect(rows.find((r) => r.id === "a")!.values.f).toBe(30);
    expect(rows.find((r) => r.id === "d")!.values.f).toBe(0);
    expect(rows.find((r) => r.id === "a")!.values.rl).toBe(100);
    expect(rows.find((r) => r.id === "c")!.values.rl).toBe(150);
    expect(rows.find((r) => r.id === "b")!.values.rl).toBe(0);
  });

  it("filtra por estado, etiquetas, número, fecha relativa y casilla (AND/OR anidado)", () => {
    expect(titles(q({ filter: { op: "and", conditions: [{ propertyId: "st", operator: "is", value: "done" }] } }))).toEqual(["Revisar código"]);
    expect(titles(q({ filter: { op: "and", conditions: [{ propertyId: "tg", operator: "contains", value: "t2" }] } })).sort()).toEqual(["Comprar café", "Revisar código"]);
    expect(titles(q({ filter: { op: "and", conditions: [{ propertyId: "n", operator: "gte", value: 3 }] } })).sort()).toEqual(["Escribir informe", "Revisar código"]);
    expect(titles(q({ filter: { op: "and", conditions: [{ propertyId: "d", operator: "is", value: "today" }] } }))).toEqual(["Comprar café"]);
    expect(titles(q({ filter: { op: "and", conditions: [{ propertyId: "d", operator: "after", value: "today" }] } }))).toEqual(["Escribir informe"]);
    expect(titles(q({ filter: { op: "and", conditions: [{ propertyId: "ok", operator: "is", value: true }] } })).sort()).toEqual(["Comprar café", "Revisar código"]);
    const nested = q({
      filter: {
        op: "or",
        conditions: [
          { propertyId: "st", operator: "is", value: "todo" },
          { op: "and", conditions: [{ propertyId: "ok", operator: "is", value: true }, { propertyId: "n", operator: "gt", value: 4 }] },
        ],
      },
    });
    expect(titles(nested).sort()).toEqual(["Comprar café", "Revisar código"]);
    expect(titles(q({ filter: { op: "and", conditions: [{ propertyId: "d", operator: "is_empty" }] } })).sort()).toEqual(["Revisar código", "Ñandú"]);
  });

  it("filtra por título y busca ignorando acentos y mayúsculas", () => {
    expect(titles(q({ filter: { op: "and", conditions: [{ propertyId: TITLE_ID, operator: "contains", value: "nandu" }] } }))).toEqual(["Ñandú"]);
    expect(titles(q({}, "CAFE"))).toEqual(["Comprar café"]);
    expect(titles(q({}, "urgente")).sort()).toEqual(["Escribir informe", "Revisar código"]); // busca en nombres de opción
  });

  it("ordena con varias reglas, vacíos al final y estados por orden de opción", () => {
    expect(titles(q({ sorts: [{ propertyId: "n", direction: "desc" }] }))).toEqual(["Revisar código", "Escribir informe", "Comprar café", "Ñandú"]);
    expect(titles(q({ sorts: [{ propertyId: "n", direction: "asc" }] }))).toEqual(["Comprar café", "Escribir informe", "Revisar código", "Ñandú"]);
    expect(titles(q({ sorts: [{ propertyId: "st", direction: "asc" }] }))).toEqual(["Comprar café", "Escribir informe", "Revisar código", "Ñandú"]);
    expect(titles(q({ sorts: [{ propertyId: "ok", direction: "desc" }, { propertyId: TITLE_ID, direction: "asc" }] }))).toEqual([
      "Comprar café",
      "Revisar código",
      "Escribir informe",
      "Ñandú",
    ]);
  });

  it("agrupa por estado (con grupo vacío) y por etiqueta múltiple", () => {
    const byStatus = q({ group: { propertyId: "st" } }).groups!;
    expect(byStatus.map((g) => [g.label, g.rowIds.length])).toEqual([
      ["Sin empezar", 1],
      ["En curso", 1],
      ["Listo", 1],
      ["Sin Estado", 1],
    ]);
    const hidden = q({ group: { propertyId: "st", hideEmpty: true, hiddenGroups: ["done"] } }).groups!;
    expect(hidden.map((g) => g.key)).toEqual(["todo", "doing", "__empty__"]); // «hideEmpty» solo oculta grupos sin filas
    const byTag = q({ group: { propertyId: "tg" } }).groups!;
    expect(byTag.find((g) => g.key === "t1")!.rowIds.sort()).toEqual(["a", "c"]);
    expect(byTag.find((g) => g.key === "t2")!.rowIds.sort()).toEqual(["b", "c"]);
  });

  it("calcula pies de columna", () => {
    const r = q({ calculations: { n: "sum", ok: "percent_checked", st: "count_not_empty", d: "earliest", f: "average" } });
    expect(r.calculations).toEqual({ n: 9, ok: 50, st: 3, d: "2026-10-18", f: 22.5 });
    const filtered = q({
      filter: { op: "and", conditions: [{ propertyId: "ok", operator: "is", value: true }] },
      calculations: { n: "sum" },
    });
    expect(filtered.calculations.n).toBe(6);
  });

  it("tolera ciclos de fórmula y propiedades eliminadas", () => {
    const cyc: CollectionData = {
      props: [P("x", "formula", "X", { expression: 'prop("Y") + 1' }), P("y", "formula", "Y", { expression: 'prop("X") + 1' })],
      records: [R("r", "r", {})],
    };
    const out = runQuery("c1", (id) => (id === "c1" ? cyc : undefined), {}, { now });
    expect(out.rows).toHaveLength(1);
    expect(titles(q({ filter: { op: "and", conditions: [{ propertyId: "zzz", operator: "is", value: 1 }] } }))).toHaveLength(4);
  });
});
