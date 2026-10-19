import path from "node:path";
import { apiCreate, apiDatabase, apiOption, apiProp, apiRow, expect, gotoReady, test } from "./fixtures";

// Capturas de la documentación: solo se generan con CAPTURE_DOCS=1 (no forman parte de la suite habitual).
test.skip(process.env.CAPTURE_DOCS !== "1", "capturas de documentación desactivadas");
const OUT = path.resolve(process.cwd(), "..", "docs", "images");

const t = (text: string, marks?: { type: string; attrs?: object }[]) => ({ type: "text", text, ...(marks ? { marks } : {}) });
const p = (...c: object[]) => ({ type: "paragraph", content: c });

test("capturas de la interfaz", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const doc = await apiCreate(request, { title: "Plan de lanzamiento", icon: "🚀" });
  await request.patch(`/api/pages/${doc.id}`, {
    data: {
      cover: "gradient:oceano",
      content: {
        type: "doc",
        content: [
          { type: "heading", attrs: { level: 2 }, content: [t("Objetivo")] },
          p(t("Lanzar la "), t("versión 1.0", [{ type: "bold" }]), t(" con documentación pública y despliegue con Docker.")),
          { type: "callout", attrs: { icon: "💡", color: "gray" }, content: [p(t("Todo el equipo edita a la vez: verás sus cursores y comentarios al instante."))] },
          { type: "columnList", content: [
            { type: "column", content: [{ type: "heading", attrs: { level: 3 }, content: [t("Hecho")] }, { type: "taskList", content: [{ type: "taskItem", attrs: { checked: true }, content: [p(t("Editor de bloques"))] }, { type: "taskItem", attrs: { checked: true }, content: [p(t("Bases de datos"))] }] }] },
            { type: "column", content: [{ type: "heading", attrs: { level: 3 }, content: [t("Pendiente")] }, { type: "taskList", content: [{ type: "taskItem", attrs: { checked: false }, content: [p(t("Revisión final"))] }] }] },
          ] },
          { type: "mathBlock", attrs: { latex: String.raw`E = mc^2 + \int_0^1 x^2\,dx` } },
          { type: "codeBlock", attrs: { language: "typescript" }, content: [t("const total = items.reduce((n, i) => n + i.horas, 0); // suma de horas")] },
        ],
      },
    },
  });
  await gotoReady(page, `/${doc.id}`);
  await expect(page.getByTestId("callout")).toBeVisible();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, "pagina-clara.png") });

  await page.getByTestId("theme-toggle").click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "pagina-oscura.png") });
  await page.getByTestId("theme-toggle").click();

  const db = await apiDatabase(request, "Tareas del proyecto");
  const estado = await apiProp(request, db.cid, { name: "Estado", type: "status" });
  const horas = await apiProp(request, db.cid, { name: "Horas", type: "number" });
  await apiProp(request, db.cid, { name: "Vence", type: "date" });
  const opts = await request.get(`/api/databases/${db.cid}/query`).catch(() => null);
  void opts;
  const abierto = await apiOption(request, estado.id, "En curso");
  for (const [i, nombre] of ["Diseñar portada", "Escribir guía", "Probar despliegue", "Revisar accesibilidad", "Publicar versión"].entries()) {
    await apiRow(request, db.cid, { title: nombre, properties: { [horas.id]: (i + 1) * 3, ...(i % 2 ? { [estado.id]: abierto } : {}) } });
  }
  await gotoReady(page, `/${db.pageId}`);
  await expect(page.getByTestId("db-row")).toHaveCount(5);
  await page.screenshot({ path: path.join(OUT, "base-de-datos.png") });

  await page.keyboard.press("Control+k");
  await page.getByTestId("search-dialog").getByRole("textbox").first().fill("guia");
  await expect(page.getByTestId("search-result").first()).toBeVisible();
  await page.screenshot({ path: path.join(OUT, "busqueda.png") });
  await page.keyboard.press("Escape");

  await page.getByTestId("open-templates").click();
  await expect(page.getByTestId("template-item").first()).toBeVisible();
  await page.screenshot({ path: path.join(OUT, "plantillas.png") });
  await page.keyboard.press("Escape");

  await page.setViewportSize({ width: 390, height: 800 });
  await gotoReady(page, `/${doc.id}`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, "movil.png") });
});
