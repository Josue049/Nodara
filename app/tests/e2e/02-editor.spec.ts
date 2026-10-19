import type { Page } from "@playwright/test";
import { apiCreate, expect, gotoReady, test } from "./fixtures";

async function newPage(page: Page, title: string) {
  await gotoReady(page, "/");
  await page.getByRole("button", { name: "Nueva página" }).first().click();
  await page.getByTestId("page-title").fill(title);
  await page.getByTestId("page-title").press("Enter"); // Enter en el título enfoca el editor
  await expect(page.getByTestId("editor")).toBeFocused();
}

const saved = (page: Page) => expect(page.getByTestId("save-status")).toHaveText("Guardado");

test("escribir texto y persistir tras recargar", async ({ page }) => {
  await newPage(page, "Editor texto");
  await page.keyboard.type("Hola mundo");
  await saved(page);
  await page.reload();
  await page.locator("html[data-nodara-ready]").waitFor({ state: "attached" });
  await expect(page.getByTestId("editor")).toContainText("Hola mundo");
});

test("menú / inserta encabezado, filtra y navega con teclado", async ({ page }) => {
  await newPage(page, "Editor slash");
  await page.keyboard.type("/");
  const menu = page.getByTestId("slash-menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("option")).toHaveCount(22);
  await page.keyboard.type("encab");
  await expect(menu.getByRole("option")).toHaveCount(3);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter"); // Encabezado 2
  await expect(menu).toBeHidden();
  await page.keyboard.type("Sección");
  await expect(page.getByTestId("editor").locator("h2")).toHaveText("Sección");
  await saved(page);
  await page.reload();
  await page.locator("html[data-nodara-ready]").waitFor({ state: "attached" });
  await expect(page.getByTestId("editor").locator("h2")).toHaveText("Sección");
});

test("Escape cierra el menú sin insertar nada", async ({ page }) => {
  await newPage(page, "Editor escape");
  await page.keyboard.type("/");
  await expect(page.getByTestId("slash-menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("slash-menu")).toBeHidden();
});

test("lista de tareas: marcar y persistir", async ({ page }) => {
  await newPage(page, "Editor tareas");
  await page.keyboard.type("/tareas");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Comprar pan");
  const item = page.getByTestId("editor").locator('ul[data-type="taskList"] > li');
  await item.locator('input[type="checkbox"]').check();
  await expect(item).toHaveAttribute("data-checked", "true");
  await saved(page);
  await page.reload();
  await page.locator("html[data-nodara-ready]").waitFor({ state: "attached" });
  await expect(page.getByTestId("editor").locator('ul[data-type="taskList"] > li')).toHaveAttribute("data-checked", "true");
});

test("atajos de markdown y formatos", async ({ page }) => {
  await newPage(page, "Editor markdown");
  await page.keyboard.type("# Título grande");
  await page.keyboard.press("Enter");
  await page.keyboard.type("- uno");
  await page.keyboard.press("Enter");
  await page.keyboard.type("dos");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter"); // sale de la lista
  await page.keyboard.type("**negrita** y `código` ");
  const ed = page.getByTestId("editor");
  await expect(ed.locator("h1")).toHaveText("Título grande");
  await expect(ed.locator("ul > li")).toHaveCount(2);
  await expect(ed.locator("strong")).toHaveText("negrita");
  await expect(ed.locator("code")).toHaveText("código");
});

test("bloque desplegable se inserta y se pliega", async ({ page }) => {
  await newPage(page, "Editor toggle");
  await page.keyboard.type("/desplegable");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Resumen");
  await expect(page.getByTestId("editor").locator(".nd-details")).toHaveCount(1);
  await expect(page.getByTestId("editor")).toContainText("Resumen");
  const toggle = page.getByTestId("editor").locator(".nd-details > button");
  const wasOpen = await page.locator(".nd-details.is-open").count();
  await toggle.click();
  await expect(page.locator(".nd-details.is-open")).toHaveCount(wasOpen ? 0 : 1);
  await saved(page);
  await page.reload();
  await page.locator("html[data-nodara-ready]").waitFor({ state: "attached" });
  await expect(page.getByTestId("editor").locator(".nd-details")).toHaveCount(1);
});

test("API: rechaza contenido que no es un documento", async ({ request }) => {
  const created = await apiCreate(request, {});
  const bad = await request.patch(`/api/pages/${created.id}`, { data: { content: [1, 2] } });
  expect(bad.status()).toBe(400);
  const ok = await request.patch(`/api/pages/${created.id}`, { data: { content: { type: "doc", content: [] } } });
  expect(ok.status()).toBe(200);
});
