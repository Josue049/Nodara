import { apiCreate, expect, gotoReady, test } from "./fixtures";

const budget = (name: string, ms: number, limit: number) => {
  test.info().annotations.push({ type: "métrica", description: `${name}: ${Math.round(ms)} ms (límite ${limit} ms)` });
  expect(ms, `${name} tardó ${Math.round(ms)} ms`).toBeLessThan(limit);
};

test.describe("rendimiento con datos grandes", () => {
  test.setTimeout(120_000);

  test("una base de datos con 1500 filas importadas por CSV se abre y se filtra con fluidez", async ({ page, request }) => {
    const rows = ["Nombre,Horas,Estado"];
    for (let i = 1; i <= 1500; i++) rows.push(`Tarea ${i},${i % 40},${["Abierta", "En curso", "Cerrada"][i % 3]}`);
    const imp = await request.post("/api/import", { multipart: { file: { name: "grande.csv", mimeType: "text/csv", buffer: Buffer.from(rows.join("\n")) } } });
    expect(imp.status()).toBe(201);
    const { id } = await imp.json();

    let t0 = Date.now();
    await gotoReady(page, `/${id}`);
    await expect(page.getByTestId("db-row").first()).toBeVisible();
    budget("abrir tabla de 1500 filas", Date.now() - t0, 8000);
    const domNodes = await page.evaluate(() => document.getElementsByTagName("*").length);
    test.info().annotations.push({ type: "métrica", description: `nodos DOM: ${domNodes}` });
    expect(domNodes).toBeLessThan(8000); // solo se pintan 100 filas; el resto se carga a petición
    await expect(page.getByTestId("db-row")).toHaveCount(100);
    await expect(page.getByTestId("load-more")).toContainText("1400 restantes");
    await page.getByTestId("load-more").click();
    await expect(page.getByTestId("db-row")).toHaveCount(200);

    // búsqueda dentro de la base
    t0 = Date.now();
    await page.getByTestId("search-btn").click();
    await page.getByRole("textbox", { name: /Buscar/ }).last().fill("Tarea 1499");
    await expect(page.getByTestId("db-row")).toHaveCount(1);
    budget("buscar en la tabla", Date.now() - t0, 3000);
  });

  test("500 páginas: la barra lateral, la búsqueda global y el cambio de página responden", async ({ page, request }) => {
    const ids: string[] = [];
    for (let i = 1; i <= 500; i++) ids.push((await apiCreate(request, { title: `Página ${i}` })).id);
    await request.patch(`/api/pages/${ids[499]}`, { data: { content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "aguja en el pajar" }] }] } } });
    let t0 = Date.now();
    await gotoReady(page, `/${ids[0]}`);
    await expect(page.getByRole("link", { name: "Página 500" })).toBeVisible();
    budget("abrir con 500 páginas en la barra lateral", Date.now() - t0, 8000);

    t0 = Date.now();
    await page.keyboard.press("Control+k");
    await page.getByTestId("search-dialog").getByRole("textbox").first().fill("aguja");
    await expect(page.getByTestId("search-result")).toHaveCount(1);
    budget("búsqueda global entre 500 páginas", Date.now() - t0, 3000);
    await page.keyboard.press("Escape");

    t0 = Date.now();
    await page.getByRole("link", { name: "Página 250" }).click();
    await expect(page.getByTestId("page-title")).toHaveValue("Página 250");
    budget("cambiar de página", Date.now() - t0, 3000);
  });

  test("un documento largo (400 bloques) se edita sin retardo perceptible", async ({ page, request }) => {
    const doc = await apiCreate(request, { title: "Largo" });
    const content = Array.from({ length: 400 }, (_, i) => ({ type: "paragraph", content: [{ type: "text", text: `Párrafo número ${i + 1} con algo de texto para ocupar espacio en la página.` }] }));
    await request.patch(`/api/pages/${doc.id}`, { data: { content: { type: "doc", content } } });
    let t0 = Date.now();
    await gotoReady(page, `/${doc.id}`);
    await expect(page.getByTestId("editor")).toContainText("Párrafo número 400");
    budget("abrir documento de 400 bloques", Date.now() - t0, 8000);

    await page.getByTestId("editor").locator("p").nth(200).click();
    t0 = Date.now();
    await page.keyboard.type("0123456789", { delay: 0 });
    await expect(page.getByTestId("editor")).toContainText("0123456789");
    budget("escribir 10 caracteres en el medio del documento", Date.now() - t0, 2500);
    await expect(page.getByTestId("save-status")).toHaveText("Guardado", { timeout: 15_000 });
  });
});
