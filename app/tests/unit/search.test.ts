import { beforeEach, describe, expect, it } from "vitest";
import { fold, makeSnippet, markTerms, MARK_CLOSE, MARK_OPEN, parseQuery, scoreDocument, splitMarks } from "@/lib/search";
import { createDb, type Db } from "@/server/db";
import { createPage, searchPages, updatePage } from "@/server/pages-service";
import { pages } from "@/server/schema";
import { eq } from "drizzle-orm";

describe("normalización", () => {
  it("quita acentos y mayúsculas sin cambiar la longitud", () => {
    for (const s of ["Reunión", "ÁÉÍÓÚ ñ Ü", "straße", "İstanbul", "😀 café"]) expect(fold(s)).toHaveLength(s.length);
    expect(fold("Reunión Ñandú")).toBe("reunion nandu");
  });
  it("separa términos y respeta frases entre comillas", () => {
    expect(parseQuery('plan "reunión semanal" Plan')).toEqual(["plan", "reunion semanal"]);
    expect(parseQuery("   ")).toEqual([]);
  });
});

describe("puntuación", () => {
  it("exige todos los términos", () => {
    expect(scoreDocument("Plan anual", "presupuesto", parseQuery("plan presupuesto"))).not.toBeNull();
    expect(scoreDocument("Plan anual", "presupuesto", parseQuery("plan viajes"))).toBeNull();
  });
  it("título exacto > empieza por > contiene > solo contenido", () => {
    const q = parseQuery("plan");
    const exact = scoreDocument("Plan", "", q)!.score;
    const starts = scoreDocument("Plan anual", "", q)!.score;
    const contains = scoreDocument("Mi plan", "", q)!.score;
    const content = scoreDocument("Otra", "hablamos del plan", q)!.score;
    expect(exact).toBeGreaterThan(starts);
    expect(starts).toBeGreaterThan(contains);
    expect(contains).toBeGreaterThan(content);
  });
  it("solo títulos ignora el contenido", () => {
    expect(scoreDocument("Otra", "plan", parseQuery("plan"), true)).toBeNull();
  });
});

describe("resaltado", () => {
  it("marca coincidencias sin acentos y se puede dividir para pintar", () => {
    const marked = markTerms("La Reunión de hoy", ["reunion"]);
    expect(marked).toBe(`La ${MARK_OPEN}Reunión${MARK_CLOSE} de hoy`);
    expect(splitMarks(marked)).toEqual([
      { text: "La ", hit: false },
      { text: "Reunión", hit: true },
      { text: " de hoy", hit: false },
    ]);
  });
  it("el fragmento recorta alrededor de la coincidencia con puntos suspensivos", () => {
    const text = "x".repeat(200) + " presupuesto " + "y".repeat(200);
    const snip = makeSnippet(text, ["presupuesto"], text.indexOf("presupuesto"));
    expect(snip.startsWith("…")).toBe(true);
    expect(snip.endsWith("…")).toBe(true);
    expect(snip).toContain(`${MARK_OPEN}presupuesto${MARK_CLOSE}`);
    expect(snip.length).toBeLessThan(200);
  });
  it("no inyecta HTML: el texto se devuelve tal cual", () => {
    expect(splitMarks(markTerms("<b>hola</b>", ["hola"])).map((p) => p.text).join("")).toBe("<b>hola</b>");
  });
});

describe("searchPages con filtros", () => {
  let db: Db;
  beforeEach(async () => {
    db = await createDb("memory://");
  });
  const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

  it("combina varios términos, filtra por antigüedad, tipo y subárbol, y ordena", async () => {
    const parent = await createPage(db, { title: "Proyecto" });
    const child = await createPage(db, { title: "Informe", parentId: parent.id });
    await updatePage(db, child.id, { content: doc("resultados del trimestre y presupuesto") });
    const other = await createPage(db, { title: "Informe viejo" });
    await updatePage(db, other.id, { content: doc("presupuesto del trimestre") });
    await db.update(pages).set({ updatedAt: new Date(Date.now() - 40 * 86_400_000) }).where(eq(pages.id, other.id));

    expect((await searchPages(db, "trimestre presupuesto")).map((r) => r.title).sort()).toEqual(["Informe", "Informe viejo"]);
    expect((await searchPages(db, "trimestre viajes"))).toHaveLength(0);
    expect((await searchPages(db, "informe", { editedWithinDays: 30 })).map((r) => r.title)).toEqual(["Informe"]);
    expect((await searchPages(db, "informe", { inside: parent.id })).map((r) => r.title)).toEqual(["Informe"]);
    expect((await searchPages(db, "", { kind: "database" }))).toHaveLength(0);
    const byEdit = await searchPages(db, "informe", { sort: "edited" });
    expect(byEdit.map((r) => r.title)).toEqual(["Informe", "Informe viejo"]);
    const [first] = await searchPages(db, "presupuesto");
    expect(first.titleMarked).toBe(first.title);
    expect(first.snippet).toContain(MARK_OPEN);
  });
});
