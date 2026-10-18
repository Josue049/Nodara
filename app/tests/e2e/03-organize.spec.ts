import type { Page } from "@playwright/test";
import { apiCreate, expect, sidebarRow, test } from "./fixtures";

const rowTitles = (page: Page) => page.getByTestId("sidebar-page").locator("a, input").evaluateAll((els) =>
  els.map((e) => (e instanceof HTMLInputElement ? e.value : (e.textContent ?? "").trim())),
);

async function drag(page: Page, from: string, to: string, where: "before" | "inside" | "after") {
  const src = (await sidebarRow(page, from).boundingBox())!;
  const dst = (await sidebarRow(page, to).boundingBox())!;
  const y = where === "before" ? dst.y + 3 : where === "after" ? dst.y + dst.height - 3 : dst.y + dst.height / 2;
  await page.mouse.move(src.x + 80, src.y + src.height / 2);
  await page.mouse.down();
  await page.mouse.move(src.x + 80, src.y + src.height / 2 + 12, { steps: 4 });
  await page.mouse.move(dst.x + 80, y, { steps: 8 });
  await page.mouse.up();
}

test("menú contextual con clic derecho muestra las acciones y atajos", async ({ page, request }) => {
  await apiCreate(request, { title: "Alfa" });
  await page.goto("/");
  await sidebarRow(page, "Alfa").click({ button: "right" });
  const menu = page.getByRole("menu");
  for (const name of ["Agregar a favoritos|Añadir a favoritos", "Copiar enlace", "Duplicar", "Cambiar nombre", "^Mover a Ctrl", "Mover a la papelera"]) {
    await expect(menu.getByRole("menuitem", { name: new RegExp(name) })).toBeVisible();
  }
  await expect(menu.getByRole("menuitem", { name: /Duplicar/ })).toContainText("Ctrl+D");
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
});

test("duplicar copia el subárbol y navega a la copia", async ({ page, request }) => {
  const a = await apiCreate(request, { title: "Alfa" });
  await apiCreate(request, { title: "Hija", parentId: a.id });
  await page.goto(`/${a.id}`);
  await sidebarRow(page, /^Alfa$/).click({ button: "right" });
  await page.getByRole("menuitem", { name: /Duplicar/ }).click();
  await expect(page).not.toHaveURL(new RegExp(a.id));
  await expect(page.getByTestId("page-title")).toHaveValue("Alfa");
  await expect(page.getByTestId("sidebar-page").filter({ hasText: /^Alfa$/ })).toHaveCount(2);
  await expect.poll(async () => (await (await request.get("/api/pages")).json()).length).toBe(4);
});

test("Ctrl+D duplica la página abierta", async ({ page, request }) => {
  const a = await apiCreate(request, { title: "Beta" });
  await page.goto(`/${a.id}`);
  await expect(page.getByTestId("page-title")).toHaveValue("Beta");
  await page.keyboard.press("Control+d");
  await expect(page).not.toHaveURL(new RegExp(a.id));
  await expect.poll(async () => (await (await request.get("/api/pages")).json()).length).toBe(2);
});

test("renombrar en la barra lateral (menú y Ctrl+⇧+R) persiste; Escape cancela", async ({ page, request }) => {
  const a = await apiCreate(request, { title: "Gamma" });
  await page.goto(`/${a.id}`);
  await sidebarRow(page, "Gamma").click({ button: "right" });
  await page.getByRole("menuitem", { name: /Cambiar nombre/ }).click();
  const input = page.getByRole("textbox", { name: "Cambiar nombre" });
  await expect(input).toBeFocused();
  await input.fill("Gamma 2");
  await input.press("Enter");
  await expect(sidebarRow(page, "Gamma 2")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("page-title")).toHaveValue("Gamma 2");

  await page.keyboard.press("Control+Shift+R");
  const again = page.getByRole("textbox", { name: "Cambiar nombre" });
  await again.fill("descartado");
  await again.press("Escape");
  await expect(sidebarRow(page, "Gamma 2")).toBeVisible();
});

test("Mover a: elegir página padre y volver a la raíz", async ({ page, request }) => {
  await apiCreate(request, { title: "Destino" });
  const b = await apiCreate(request, { title: "Mover yo" });
  await page.goto(`/${b.id}`);
  await page.keyboard.press("Control+Shift+P");
  const dialog = page.getByTestId("move-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("move-option").filter({ hasText: "Mover yo" })).toHaveCount(0); // no a sí misma
  await dialog.getByTestId("move-option").filter({ hasText: "Destino" }).click();
  await expect.poll(async () => (await (await request.get(`/api/pages/${b.id}`)).json()).parentId).not.toBeNull();
  await expect(page.getByRole("navigation", { name: "Ruta" })).toContainText("Destino");

  await page.keyboard.press("Control+Shift+P");
  await page.getByTestId("move-dialog").getByRole("button", { name: "Privado" }).click();
  await expect.poll(async () => (await (await request.get(`/api/pages/${b.id}`)).json()).parentId).toBeNull();
});

test("arrastrar y soltar: reordenar y anidar con persistencia", async ({ page, request }) => {
  await apiCreate(request, { title: "Uno" });
  await apiCreate(request, { title: "Dos" });
  await apiCreate(request, { title: "Tres" });
  await page.goto("/");
  await expect(page.getByTestId("sidebar-page")).toHaveCount(3);

  await drag(page, "Tres", "Uno", "before");
  await expect.poll(() => rowTitles(page)).toEqual(["Tres", "Uno", "Dos"]);
  await page.reload();
  await expect.poll(() => rowTitles(page)).toEqual(["Tres", "Uno", "Dos"]);

  await drag(page, "Dos", "Tres", "inside"); // Dos pasa a ser hija de Tres
  await expect.poll(async () => {
    const all: { title: string; parentId: string | null; id: string }[] = await (await request.get("/api/pages")).json();
    const tres = all.find((p) => p.title === "Tres")!;
    return all.find((p) => p.title === "Dos")!.parentId === tres.id;
  }).toBe(true);
  await expect(sidebarRow(page, "Dos")).toBeVisible(); // el padre se expande
});

test("no se puede soltar una página dentro de su propio descendiente", async ({ page, request }) => {
  const a = await apiCreate(request, { title: "Padre" });
  await apiCreate(request, { title: "Hijo", parentId: a.id });
  await page.goto("/");
  await sidebarRow(page, "Padre").getByRole("button", { name: "Expandir" }).click();
  await drag(page, "Padre", "Hijo", "inside");
  const all: { title: string; parentId: string | null }[] = await (await request.get("/api/pages")).json();
  expect(all.find((p) => p.title === "Padre")!.parentId).toBeNull();
});

test("búsqueda Ctrl+K: título, contenido, solo títulos y navegación con teclado", async ({ page, request }) => {
  await apiCreate(request, { title: "Presupuesto mensual" });
  const n = await apiCreate(request, { title: "Notas" });
  await request.patch(`/api/pages/${n.id}`, {
    data: { content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Revisar el presupuesto anual con Ana" }] }] } },
  });
  await page.goto("/");
  await page.keyboard.press("Control+k");
  const dialog = page.getByTestId("search-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox").fill("PRESUPUESTO");
  const results = dialog.getByTestId("search-result");
  await expect(results).toHaveCount(2);
  await expect(results.first()).toContainText("Presupuesto mensual"); // coincidencia de título primero
  await expect(results.nth(1)).toContainText("presupuesto anual");
  await dialog.getByRole("button", { name: "Solo títulos" }).click();
  await expect(results).toHaveCount(1);
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("page-title")).toHaveValue("Presupuesto mensual");

  await page.getByTestId("open-search").click();
  await page.getByTestId("search-dialog").getByRole("textbox").fill("zzz-nada");
  await expect(page.getByText("Sin resultados")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("search-dialog")).toBeHidden();
});

test("icono de página: elegir, ver en la barra lateral, persistir y quitar", async ({ page, request }) => {
  const a = await apiCreate(request, { title: "Con icono" });
  await page.goto(`/${a.id}`);
  await page.getByTestId("add-icon").click({ force: true });
  const picker = page.getByTestId("emoji-picker");
  await picker.getByRole("textbox").fill("cohete");
  await picker.getByRole("button", { name: /cohete/ }).click();
  await expect(page.getByTestId("page-icon")).toHaveText("🚀");
  await expect(sidebarRow(page, "Con icono")).toContainText("🚀");
  await page.reload();
  await expect(page.getByTestId("page-icon")).toHaveText("🚀");

  await page.getByTestId("page-icon").click();
  await page.getByTestId("emoji-picker").getByRole("button", { name: "Quitar" }).click();
  await expect(page.getByTestId("page-icon")).toHaveCount(0);
  await expect(sidebarRow(page, "Con icono")).not.toContainText("🚀");
});

test("tema oscuro: alternar y recordar tras recargar", async ({ page }) => {
  await page.goto("/");
  const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
  const initial = await theme();
  await page.getByTestId("theme-toggle").click();
  const flipped = initial === "dark" ? "light" : "dark";
  expect(await theme()).toBe(flipped);
  await page.reload();
  expect(await theme()).toBe(flipped);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe(flipped === "dark" ? "rgb(25, 25, 25)" : "rgb(255, 255, 255)");
});
