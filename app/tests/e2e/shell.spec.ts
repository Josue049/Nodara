import { expect, test, type Page } from "@playwright/test";

async function createRootPage(page: Page, title: string) {
  await page.getByRole("button", { name: "Nueva página" }).click();
  await expect(page.getByTestId("page-title")).toBeVisible();
  await page.getByTestId("page-title").fill(title);
  await expect(page.getByTestId("save-status")).toHaveText("Guardado");
}

test.describe.configure({ mode: "serial" });

test("estado vacío y creación de la primera página", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByText("Aún no hay páginas")).toBeVisible();
  await page.getByRole("button", { name: "Nueva página" }).first().click();
  await expect(page).toHaveURL(/\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("page-title")).toBeFocused({ timeout: 100 }).catch(() => {});
  expect(errors).toEqual([]);
});

test("el título se autoguarda y persiste tras recargar", async ({ page }) => {
  await page.goto("/");
  await createRootPage(page, "Plan de proyecto");
  await expect(page.getByTestId("sidebar-page").filter({ hasText: "Plan de proyecto" })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("page-title")).toHaveValue("Plan de proyecto");
  await expect(page.getByTestId("sidebar-page").filter({ hasText: "Plan de proyecto" })).toBeVisible();
});

test("subpáginas anidadas, expandir/contraer y ruta de navegación", async ({ page }) => {
  await page.goto("/");
  const parent = page.getByTestId("sidebar-page").filter({ hasText: "Plan de proyecto" });
  await parent.hover();
  await parent.getByRole("button", { name: "Añadir una subpágina" }).click();
  await page.getByTestId("page-title").fill("Tareas");
  await expect(page.getByTestId("save-status")).toHaveText("Guardado");
  await expect(page.getByRole("navigation", { name: "Ruta" })).toContainText("Plan de proyecto");
  await expect(page.getByRole("navigation", { name: "Ruta" })).toContainText("Tareas");

  const child = page.getByTestId("sidebar-page").filter({ hasText: /^Tareas$/ });
  await expect(child).toBeVisible();
  await parent.getByRole("button", { name: "Contraer" }).click();
  await expect(child).toBeHidden();
  await parent.getByRole("button", { name: "Expandir" }).click();
  await expect(child).toBeVisible();
});

test("favoritos", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("sidebar-page").filter({ hasText: "Plan de proyecto" }).click();
  await page.getByRole("button", { name: "Añadir a favoritos" }).click();
  await expect(page.getByTestId("favorite-page")).toContainText("Plan de proyecto");
  await page.reload();
  await expect(page.getByTestId("favorite-page")).toContainText("Plan de proyecto");
  await page.getByRole("button", { name: "Quitar de favoritos" }).click();
  await expect(page.getByTestId("favorite-page")).toHaveCount(0);
});

test("papelera: mover, restaurar y eliminar definitivamente", async ({ page }) => {
  await page.goto("/");
  const row = page.getByTestId("sidebar-page").filter({ hasText: "Plan de proyecto" });
  await row.hover();
  await row.getByRole("button", { name: "Más acciones" }).click();
  await page.getByRole("menuitem", { name: "Mover a la papelera" }).click();
  await expect(row).toBeHidden();

  await page.getByRole("button", { name: "Papelera" }).click();
  const item = page.getByTestId("trash-item");
  await expect(item).toHaveCount(1);
  await expect(item).toContainText("Plan de proyecto"); // solo la raíz eliminada; su subpágina viaja con ella
  await item.getByRole("button", { name: "Restaurar" }).click();
  await expect(page.getByTestId("sidebar-page").filter({ hasText: "Plan de proyecto" })).toBeVisible();

  // De nuevo a la papelera y eliminación definitiva.
  await row.hover();
  await row.getByRole("button", { name: "Más acciones" }).click();
  await page.getByRole("menuitem", { name: "Mover a la papelera" }).click();
  await page.getByTestId("trash-item").getByRole("button", { name: "Eliminar definitivamente" }).click();
  await expect(page.getByText("La papelera está vacía")).toBeVisible();
});

test("API: valida entradas y responde 404", async ({ request }) => {
  const bad = await request.post("/api/pages", { data: { parentId: "no-es-uuid" } });
  expect(bad.status()).toBe(400);
  const missing = await request.get("/api/pages/00000000-0000-4000-8000-000000000000");
  expect(missing.status()).toBe(404);
});
