import type { Page } from "@playwright/test";
import { apiCreate, expect, gotoReady, newUser, test } from "./fixtures";

// PNG de 1×1 píxel
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

async function openPage(page: Page, title: string) {
  await gotoReady(page, "/");
  await page.getByRole("button", { name: "Nueva página" }).first().click();
  await page.getByTestId("page-title").fill(title);
  await page.getByTestId("page-title").press("Enter");
  await expect(page.getByTestId("editor")).toBeFocused();
}
async function slash(page: Page, query: string) {
  await page.keyboard.type(`/${query}`);
  await expect(page.getByTestId("slash-menu")).toBeVisible();
  await page.keyboard.press("Enter");
}
const saved = (page: Page) => expect(page.getByTestId("save-status")).toHaveText("Guardado");
const reload = async (page: Page) => {
  await page.reload();
  await page.locator("html[data-nodara-ready]").waitFor({ state: "attached" });
};

test.describe("bloques avanzados del editor", () => {
  test("llamada: se inserta, admite texto, cambia de color y persiste", async ({ page }) => {
    await openPage(page, "Llamadas");
    await slash(page, "llamada");
    await expect(page.getByTestId("callout")).toBeVisible();
    await page.keyboard.type("Aviso importante");
    await page.getByTestId("callout").hover();
    await page.getByRole("button", { name: "Color blue" }).click();
    await expect(page.getByTestId("callout")).toHaveAttribute("data-color", "blue");
    await saved(page);
    await reload(page);
    await expect(page.getByTestId("callout")).toContainText("Aviso importante");
    await expect(page.getByTestId("callout")).toHaveAttribute("data-color", "blue");
  });

  test("llamada: el icono se cambia con el selector de emoji", async ({ page }) => {
    await openPage(page, "Icono de llamada");
    await slash(page, "llamada");
    await page.getByTestId("callout-icon").click();
    await page.getByRole("button", { name: "fuego" }).first().click();
    await expect(page.getByTestId("callout-icon")).toHaveText("🔥");
  });

  test("imagen: subir un archivo la muestra, admite pie de foto y persiste", async ({ page }) => {
    await openPage(page, "Imágenes");
    await slash(page, "imagen");
    await expect(page.getByTestId("image-picker")).toBeVisible();
    await page.getByTestId("image-file-input").setInputFiles({ name: "punto.png", mimeType: "image/png", buffer: PNG });
    const img = page.getByTestId("image-block").locator("img");
    await expect(img).toBeVisible();
    await expect(img).toHaveAttribute("src", /^\/api\/files\//);
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(1);
    await page.getByLabel("Pie de foto").fill("Un píxel");
    await saved(page);
    await reload(page);
    await expect(page.getByTestId("image-block").locator("img")).toBeVisible();
    await expect(page.getByLabel("Pie de foto")).toHaveValue("Un píxel");
  });

  test("imagen: pegar un archivo de imagen la inserta", async ({ page }) => {
    await openPage(page, "Imagen pegada");
    await page.evaluate(async (b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const file = new File([bytes], "pegada.png", { type: "image/png" });
      const dt = new DataTransfer();
      dt.items.add(file);
      document.querySelector('[data-testid="editor"]')!.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    }, PNG.toString("base64"));
    await expect(page.getByTestId("image-block").locator("img")).toBeVisible();
  });

  test("imagen: rechaza enlaces peligrosos", async ({ page }) => {
    await openPage(page, "Imagen enlace");
    await slash(page, "imagen");
    await page.getByLabel("Enlace de imagen").fill("javascript:alert(1)");
    await page.getByRole("button", { name: "Insertar" }).click();
    await expect(page.getByTestId("image-picker").getByRole("alert")).toContainText("http(s)");
  });

  test("archivo adjunto: se sube, muestra el nombre y se descarga", async ({ page, request }) => {
    await openPage(page, "Archivos");
    await slash(page, "archivo");
    await page.getByTestId("file-file-input").setInputFiles({ name: "informe.txt", mimeType: "text/plain", buffer: Buffer.from("contenido del informe") });
    const block = page.getByTestId("file-block");
    await expect(block).toContainText("informe.txt");
    const href = await block.locator("a").getAttribute("href");
    expect(href).toMatch(/^\/api\/files\//);
    const res = await request.get(href!);
    expect(res.status()).toBe(200);
    expect(await res.text()).toBe("contenido del informe");
  });

  test("marcador web: guarda un enlace como tarjeta", async ({ page }) => {
    await openPage(page, "Marcadores");
    await slash(page, "marcador");
    await page.getByLabel("Enlace de marcador").fill("ejemplo.com/docs");
    await page.getByRole("button", { name: "Insertar" }).click();
    const bm = page.getByTestId("bookmark");
    await expect(bm).toContainText("ejemplo.com");
    await expect(bm.locator("a")).toHaveAttribute("href", "https://ejemplo.com/docs");
    await expect(bm.locator("a")).toHaveAttribute("rel", /noopener/);
  });

  test("ecuación en bloque: vista previa, validación y representación con KaTeX", async ({ page }) => {
    await openPage(page, "Ecuaciones");
    await slash(page, "ecuacion");
    const editor = page.getByTestId("math-editor");
    await expect(editor).toBeVisible();
    await page.getByLabel("Expresión LaTeX").fill("\\frac{a}{");
    await expect(editor).toContainText("Expresión no válida");
    await expect(page.getByTestId("math-done")).toBeDisabled();
    await page.getByLabel("Expresión LaTeX").fill("E = mc^2");
    await expect(editor.locator(".katex")).toBeVisible();
    await page.getByTestId("math-done").click();
    await expect(page.getByTestId("math-block").locator(".katex")).toBeVisible();
    await saved(page);
    await reload(page);
    await expect(page.getByTestId("math-block").locator(".katex")).toContainText("mc");
  });

  test("ecuación en línea: $x^2$ se convierte en ecuación dentro del texto", async ({ page }) => {
    await openPage(page, "Ecuación en línea");
    await page.keyboard.type("Vale $x^2$");
    await expect(page.getByTestId("math-inline").locator(".katex")).toBeVisible();
    await saved(page);
    await reload(page);
    await expect(page.getByTestId("math-inline").locator(".katex")).toBeVisible();
  });

  test("tabla de contenidos: lista los encabezados y se actualiza", async ({ page }) => {
    await openPage(page, "Índice");
    await slash(page, "contenidos");
    await expect(page.getByTestId("toc")).toContainText("Añade encabezados");
    await page.getByTestId("editor").locator("p").last().click();
    await page.keyboard.press("Control+End");
    await slash(page, "h1");
    await page.keyboard.type("Introducción");
    await expect(page.getByTestId("toc")).toContainText("Introducción");
    await page.getByTestId("toc").getByRole("button", { name: "Introducción" }).click();
  });

  test("columnas: se crean con contenido independiente y persisten", async ({ page }) => {
    await openPage(page, "Columnas");
    await slash(page, "columnas");
    const cols = page.getByTestId("editor").locator(".nd-column");
    await expect(cols).toHaveCount(2);
    await cols.nth(0).click();
    await page.keyboard.type("Izquierda");
    await cols.nth(1).click();
    await page.keyboard.type("Derecha");
    const [a, b] = await Promise.all([cols.nth(0).boundingBox(), cols.nth(1).boundingBox()]);
    expect(b!.x).toBeGreaterThan(a!.x + a!.width - 1); // lado a lado
    await saved(page);
    await reload(page);
    await expect(page.getByTestId("editor").locator(".nd-column").nth(1)).toContainText("Derecha");
  });

  test("código: elegir lenguaje resalta la sintaxis, se copia y persiste", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openPage(page, "Código");
    await slash(page, "codigo");
    await page.keyboard.type("const total = 42; // suma");
    await page.getByTestId("code-block").hover();
    await page.getByTestId("code-language").selectOption("javascript");
    await expect(page.getByTestId("code-block").locator(".hljs-keyword")).toHaveText("const");
    await expect(page.getByTestId("code-block").locator(".hljs-number")).toHaveText("42");
    await expect(page.getByTestId("code-block").locator(".hljs-comment")).toContainText("suma");
    await page.getByTestId("code-copy").click();
    await expect(page.getByTestId("code-copy")).toContainText("Copiado");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("const total = 42; // suma");
    await saved(page);
    await reload(page);
    await expect(page.getByTestId("code-language")).toHaveValue("javascript");
    await expect(page.getByTestId("code-block").locator(".hljs-keyword")).toHaveText("const");
  });

  test("los bloques nuevos se sincronizan entre dos personas", async ({ page, browser, request }) => {
    const ana = await newUser(browser, "ana@nodara.test", "Ana");
    const doc = await apiCreate(request, { title: "Compartida con bloques" });
    expect((await request.post(`/api/pages/${doc.id}/share`, { data: { email: "ana@nodara.test", level: "edit" } })).status()).toBe(201);
    await gotoReady(page, `/${doc.id}`);
    await gotoReady(ana.page, `/${doc.id}`);
    await page.getByTestId("editor").click();
    await slash(page, "llamada");
    await page.keyboard.type("Visible para Ana");
    await expect(ana.page.getByTestId("callout")).toContainText("Visible para Ana");
    await ana.context.close();
  });

  test("el contenido con bloques nuevos es válido para la API y la búsqueda", async ({ request }) => {
    const doc = await apiCreate(request, { title: "API bloques" });
    const content = {
      type: "doc",
      content: [
        { type: "callout", attrs: { icon: "💡", color: "green" }, content: [{ type: "paragraph", content: [{ type: "text", text: "texto en llamada" }] }] },
        { type: "columnList", content: [{ type: "column", content: [{ type: "paragraph", content: [{ type: "text", text: "uno" }] }] }, { type: "column", content: [{ type: "paragraph" }] }] },
        { type: "mathBlock", attrs: { latex: "a^2+b^2=c^2" } },
      ],
    };
    expect((await request.patch(`/api/pages/${doc.id}`, { data: { content } })).status()).toBe(200);
    const found = await (await request.get("/api/search?q=llamada")).json();
    expect(found.map((r: { id: string }) => r.id)).toContain(doc.id);
  });
});
