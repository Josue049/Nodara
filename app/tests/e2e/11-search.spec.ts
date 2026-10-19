import { apiCreate, expect, gotoReady, test } from "./fixtures";

const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

async function seed(request: import("@playwright/test").APIRequestContext) {
  const root = await apiCreate(request, { title: "Proyecto Orion" });
  const a = await apiCreate(request, { title: "Informe trimestral", parentId: root.id });
  await request.patch(`/api/pages/${a.id}`, { data: { content: doc("Resultados y presupuesto del trimestre") } });
  const b = await apiCreate(request, { title: "Actas" });
  await request.patch(`/api/pages/${b.id}`, { data: { content: doc("Reunión con presupuesto aprobado") } });
  return { root, a, b };
}

test.describe("búsqueda avanzada", () => {
  test("varios términos: todos deben aparecer, sin importar acentos ni mayúsculas", async ({ page, request }) => {
    await seed(request);
    await gotoReady(page, "/");
    await page.keyboard.press("Control+k");
    await page.getByRole("dialog", { name: "Buscar" }).getByRole("textbox").fill("REUNION presupuesto");
    await expect(page.getByTestId("search-result")).toHaveCount(1);
    await expect(page.getByTestId("search-result")).toContainText("Actas");
  });

  test("resalta las coincidencias en título y fragmento", async ({ page, request }) => {
    await seed(request);
    await gotoReady(page, "/");
    await page.keyboard.press("Control+k");
    await page.getByRole("dialog", { name: "Buscar" }).getByRole("textbox").fill("presupuesto");
    await expect(page.getByTestId("search-snippet").locator("mark").first()).toHaveText(/presupuesto/i);
    await page.getByRole("dialog", { name: "Buscar" }).getByRole("textbox").fill("orion");
    await expect(page.getByTestId("search-result").first().locator("mark")).toHaveText("Orion");
  });

  test("filtros por tipo, fecha y orden", async ({ page, request }) => {
    const { b } = await seed(request);
    await request.post("/api/databases", { data: { title: "Inventario" } });
    await gotoReady(page, "/");
    await page.keyboard.press("Control+k");
    const dialog = page.getByTestId("search-dialog");
    await dialog.getByLabel("Tipo").selectOption("database");
    await expect(page.getByTestId("search-result")).toHaveCount(1);
    await expect(page.getByTestId("search-result")).toContainText("Inventario");
    await dialog.getByLabel("Tipo").selectOption("");
    await dialog.getByLabel("Ordenar por").selectOption("edited");
    await expect(page.getByTestId("search-result").first()).toContainText("Inventario"); // lo último creado
    await dialog.getByLabel("Editado").selectOption("day");
    await expect(page.getByTestId("search-result").first()).toBeVisible();
    void b;
  });

  test("«En esta página» limita la búsqueda al subárbol abierto", async ({ page, request }) => {
    const { root } = await seed(request);
    await gotoReady(page, `/${root.id}`);
    await page.keyboard.press("Control+k");
    const dialog = page.getByTestId("search-dialog");
    await dialog.getByRole("textbox").first().fill("presupuesto");
    await expect(page.getByTestId("search-result")).toHaveCount(2);
    await page.getByTestId("filter-inside").click();
    await expect(page.getByTestId("search-result")).toHaveCount(1);
    await expect(page.getByTestId("search-result")).toContainText("Informe trimestral");
  });

  test("la API valida los parámetros", async ({ request }) => {
    expect((await request.get("/api/search?q=x&edited=siglo")).status()).toBe(400);
    expect((await request.get("/api/search?q=x&inside=no-es-uuid")).status()).toBe(400);
    expect((await request.get("/api/search?q=x&kind=record&sort=edited&edited=week")).status()).toBe(200);
  });
});
