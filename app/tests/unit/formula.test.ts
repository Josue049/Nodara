import { describe, expect, it } from "vitest";
import { evaluateFormula, FormulaError, referencedProps, validateFormula, type FValue } from "@/lib/collections/formula";

const NOW = new Date("2026-10-18T12:00:00Z");
const vars: Record<string, FValue> = {
  Precio: 100,
  Cantidad: 3,
  Nombre: "Café",
  Hecho: true,
  Tags: ["a", "b"],
  Fecha: new Date("2026-10-10T00:00:00Z"),
  Vacio: null,
};
const ev = (src: string) => evaluateFormula(src, { prop: (n) => vars[n] ?? null, now: () => NOW });

describe("fórmulas", () => {
  it("aritmética con precedencia y potencia asociativa a la derecha", () => {
    expect(ev("1 + 2 * 3")).toBe(7);
    expect(ev("(1 + 2) * 3")).toBe(9);
    expect(ev("2 ^ 3 ^ 2")).toBe(512);
    expect(ev("-3 + 10 % 4")).toBe(-1);
    expect(ev('prop("Precio") * prop("Cantidad")')).toBe(300);
  });

  it("comparación, lógica y if/ifs", () => {
    expect(ev('prop("Precio") >= 100 and prop("Hecho")')).toBe(true);
    expect(ev('not prop("Hecho") or 1 == 2')).toBe(false);
    expect(ev('if(prop("Precio") > 50, "caro", "barato")')).toBe("caro");
    expect(ev('ifs(1 > 2, "a", 2 > 3, "b", "c")')).toBe("c");
    expect(ev("if(false, 1)")).toBeNull();
  });

  it("texto y listas", () => {
    expect(ev('concat(prop("Nombre"), " ", "frío")')).toBe("Café frío");
    expect(ev('upper(prop("Nombre")) + "!"')).toBe("CAFÉ!");
    expect(ev('length(prop("Tags"))')).toBe(2);
    expect(ev('join(prop("Tags"), "-")')).toBe("a-b");
    expect(ev('contains(prop("Tags"), "b")')).toBe(true);
    expect(ev('replaceAll("a.b.c", ".", "/")')).toBe("a/b/c");
    expect(ev('empty(prop("Vacio"))')).toBe(true);
  });

  it("números y fechas", () => {
    expect(ev("round(3.14159, 2)")).toBe(3.14);
    expect(ev("max(1, 5, 3) + min(4, 2)")).toBe(7);
    expect(ev('dateBetween(now(), prop("Fecha"), "days")')).toBe(8);
    expect((ev('dateAdd(prop("Fecha"), 1, "months")') as Date).toISOString().slice(0, 10)).toBe("2026-11-10");
    expect(ev("formatDate(today())")).toBe("2026-10-18");
    expect(ev('year(prop("Fecha")) * 100 + month(prop("Fecha"))')).toBe(202610);
  });

  it("errores claros", () => {
    expect(() => ev("1 +")).toThrow(FormulaError);
    expect(() => ev("1 / 0")).toThrow("División entre cero");
    expect(() => ev("desconocida(1)")).toThrow("Función desconocida");
    expect(() => ev('"abc')).toThrow("sin cerrar");
    expect(() => ev("x")).toThrow("prop");
  });

  it("referencias y validación", () => {
    expect(referencedProps('prop("A") + if(prop("B"), prop("C"), 1)')).toEqual(["A", "B", "C"]);
    expect(validateFormula('prop("A") + 1', ["A"])).toBeNull();
    expect(validateFormula('prop("Z")', ["A"])).toMatch(/Propiedad desconocida/);
    expect(validateFormula("1 +", [])).toMatch(/incompleta/i);
  });
});
