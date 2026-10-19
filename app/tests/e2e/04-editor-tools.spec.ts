import type { Page } from "@playwright/test";
import { expect, gotoReady, test } from "./fixtures";

async function newPage(page: Page, title: string) {
  await gotoReady(page, "/");
  await page.getByRole("button", { name: "Nueva página" }).first().click();
  await page.getByTestId("page-title").fill(title);
  await page.getByTestId("page-title").press("Enter");
  await expect(page.getByTestId("editor")).toBeFocused();
}

/** Escribe una línea y la selecciona entera para que aparezca el menú de formato. */
async function typeAndSelect(page: Page, text: string) {
  await page.keyboard.type(text);
  await page.keyboard.press("Shift+Home");
  await expect(page.getByTestId("format-menu")).toBeVisible();
}

const saved = (page: Page) => expect(page.getByTestId("save-status")).toHaveText("Guardado");

test("el menú de formato aparece al seleccionar y aplica negrita, cursiva, subrayado y tachado", async ({ page }) => {
  await newPage(page, "Formato");
  await typeAndSelect(page, "Texto formateado");
  const menu = page.getByTestId("format-menu");
  await menu.getByRole("button", { name: "Negrita" }).click();
  await menu.getByRole("button", { name: "Cursiva" }).click();
  await menu.getByRole("button", { name: "Subrayado" }).click();
  await menu.getByRole("button", { name: "Tachado" }).click();
  const p = page.getByTestId("editor").locator("p").first();
  await expect(p.locator("strong")).toHaveCount(1);
  await expect(p.locator("em")).toHaveCount(1);
  await expect(p.locator("u")).toHaveCount(1);
  await expect(p.locator("s")).toHaveCount(1);
  await expect(menu.getByRole("button", { name: "Negrita" })).toHaveAttribute("aria-pressed", "true");
  await menu.getByRole("button", { name: "Borrar formato" }).click();
  await expect(p.locator("strong, em, u, s")).toHaveCount(0);
});

test("se oculta al colapsar la selección", async ({ page }) => {
  await newPage(page, "Oculta");
  await typeAndSelect(page, "algo");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("format-menu")).toBeHidden();
});

test("enlace: añadir (con https automático), persistir y quitar", async ({ page }) => {
  await newPage(page, "Enlaces");
  await typeAndSelect(page, "ejemplo");
  const menu = page.getByTestId("format-menu");
  await menu.getByRole("button", { name: "Enlace" }).click();
  await menu.getByRole("textbox", { name: "Enlace" }).fill("example.com");
  await page.keyboard.press("Enter");
  const link = page.getByTestId("editor").locator("a");
  await expect(link).toHaveAttribute("href", "https://example.com");
  await saved(page);
  await page.reload();
  await page.locator("html[data-nodara-ready]").waitFor({ state: "attached" });
  await expect(page.getByTestId("editor").locator("a")).toHaveAttribute("href", "https://example.com");
});

test("convertir en: de texto a encabezado y a lista de tareas", async ({ page }) => {
  await newPage(page, "Convertir");
  await typeAndSelect(page, "Mi bloque");
  const menu = page.getByTestId("format-menu");
  await expect(menu.getByTestId("turn-into-label")).toHaveText("Texto");
  await menu.getByTestId("turn-into-label").click();
  await menu.getByRole("option", { name: "Encabezado 1" }).click();
  await expect(page.getByTestId("editor").locator("h1")).toHaveText("Mi bloque");
  await expect(menu.getByTestId("turn-into-label")).toHaveText("Encabezado 1");
  await menu.getByTestId("turn-into-label").click();
  await menu.getByRole("option", { name: "Lista de tareas" }).click();
  await expect(page.getByTestId("editor").locator('ul[data-type="taskList"] li')).toHaveCount(1);
});

test("color de texto y de fondo se aplican y persisten", async ({ page }) => {
  await newPage(page, "Colores");
  await typeAndSelect(page, "colorido");
  const menu = page.getByTestId("format-menu");
  await menu.getByRole("button", { name: "Color", exact: true }).click();
  await menu.getByRole("button", { name: "Color del texto: Rojo" }).click();
  await menu.getByRole("button", { name: "Color de fondo: Amarillo" }).click();
  const span = page.getByTestId("editor").locator("p span").first();
  await expect(span).toHaveCSS("color", "rgb(212, 76, 71)");
  await expect(page.getByTestId("editor").locator("mark")).toHaveCSS("background-color", "rgb(251, 243, 219)");
  await saved(page);
  await page.reload();
  await page.locator("html[data-nodara-ready]").waitFor({ state: "attached" });
  await expect(page.getByTestId("editor").locator("p span").first()).toHaveCSS("color", "rgb(212, 76, 71)");
});

test("asa de bloque: «+» inserta debajo y abre el menú /; el menú del asa elimina y duplica", async ({ page }) => {
  await newPage(page, "Asa");
  await page.keyboard.type("Primer bloque");
  await page.getByTestId("editor").locator("p").first().hover();
  const handle = page.getByTestId("block-handle");
  await expect(handle).toBeVisible();
  await handle.getByRole("button", { name: "Añadir bloque debajo" }).click();
  await expect(page.getByTestId("slash-menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Backspace");
  await page.keyboard.type("Segundo bloque");
  await expect(page.getByTestId("editor").locator("p")).toHaveCount(2);

  await page.getByTestId("editor").locator("p").first().hover();
  await page.getByTestId("drag-grip").click();
  await page.getByRole("menuitem", { name: "Duplicar" }).click();
  await expect(page.getByTestId("editor").locator("p")).toHaveCount(3);

  await page.getByTestId("editor").locator("p").first().hover();
  await page.getByTestId("drag-grip").click();
  await page.getByRole("menuitem", { name: "Eliminar" }).click();
  await expect(page.getByTestId("editor").locator("p")).toHaveCount(2);
});

test("tabla: insertar con /tabla, escribir y moverse con Tab", async ({ page }) => {
  await newPage(page, "Tablas");
  await page.keyboard.type("/tabla");
  await page.keyboard.press("Enter");
  const table = page.getByTestId("editor").locator("table");
  await expect(table).toHaveCount(1);
  await expect(table.locator("th")).toHaveCount(3);
  await expect(table.locator("td")).toHaveCount(6);
  await page.keyboard.type("A");
  await page.keyboard.press("Tab");
  await page.keyboard.type("B");
  await expect(table.locator("th").nth(0)).toHaveText("A");
  await expect(table.locator("th").nth(1)).toHaveText("B");
  await saved(page);
  await page.reload();
  await page.locator("html[data-nodara-ready]").waitFor({ state: "attached" });
  await expect(page.getByTestId("editor").locator("table th").nth(1)).toHaveText("B");
});

test("arrastrar un bloque con el asa lo reordena y se guarda", async ({ page }) => {
  await newPage(page, "Orden");
  await page.keyboard.type("Uno");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Dos");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Tres");
  const paras = page.getByTestId("editor").locator("p");
  await paras.first().hover();
  const grip = page.getByTestId("drag-grip");
  await expect(grip).toBeVisible();
  await grip.dragTo(paras.nth(2), { targetPosition: { x: 40, y: 18 } });
  await expect.poll(() => paras.allTextContents()).toEqual(["Dos", "Tres", "Uno"]);
  await saved(page);
  await page.reload();
  await page.locator("html[data-nodara-ready]").waitFor({ state: "attached" });
  await expect.poll(() => page.getByTestId("editor").locator("p").allTextContents()).toEqual(["Dos", "Tres", "Uno"]);
});
