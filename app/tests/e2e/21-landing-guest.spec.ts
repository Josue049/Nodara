import type { Browser } from "@playwright/test";
import { expect, sidebarRow, TESTER, test } from "./fixtures";

/** Navegador sin sesión (el contexto de la prueba ya tiene la cuenta de `TESTER`). */
const anonymous = async (browser: Browser) => {
  const context = await browser.newContext({ baseURL: "http://127.0.0.1:3100", viewport: { width: 1440, height: 900 }, extraHTTPHeaders: { "x-nodara-e2e-token": process.env.NODARA_E2E_TOKEN ?? "" } });
  return { context, page: await context.newPage() };
};

/** Entra sin cuenta desde la portada y cierra el aviso inicial. */
async function enterAsGuest(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/bienvenida$/);
  await page.getByTestId("landing-try").click();
  await expect(page.getByTestId("account-dialog")).toBeVisible();
}

test.describe("portada y modo sin cuenta", () => {
  test("la primera visita muestra la portada con sus secciones y llamadas a la acción", async ({ browser }) => {
    const { context, page } = await anonymous(browser);
    await page.goto("/");
    await expect(page).toHaveURL(/\/bienvenida$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Tu espacio de trabajo");
    await expect(page.getByTestId("landing-try")).toBeVisible();
    await expect(page.getByTestId("landing-login")).toHaveAttribute("href", "/login");
    // Pestañas de funciones: flechas y clic cambian el panel.
    await page.getByRole("tab", { name: "Wikis" }).click();
    await expect(page.getByTestId("landing-tabpanel")).toContainText("Todo el conocimiento en un sitio");
    await page.getByRole("tab", { name: "Wikis" }).press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Proyectos" })).toBeFocused();
    await expect(page.getByTestId("landing-tabpanel")).toContainText("Planifica y sigue el trabajo");
    await context.close();
  });

  test("entrar sin cuenta abre la app con el aviso; se puede seguir sin cuenta y reabrirlo", async ({ browser }) => {
    const { context, page } = await anonymous(browser);
    await enterAsGuest(page);
    await expect(page.getByTestId("account-dialog-warning")).toContainText("necesitarás iniciar sesión o registrarte para guardar tus proyectos");
    await page.getByTestId("account-later").click();
    await expect(page.getByTestId("account-dialog")).toHaveCount(0);
    // El aviso no vuelve a salir solo en la misma sesión del navegador…
    await page.reload();
    await expect(page.getByTestId("guest-sidebar-note")).toBeVisible();
    await expect(page.getByTestId("account-dialog")).toHaveCount(0);
    // …pero se reabre desde la barra lateral, ya en la pestaña de registro.
    await page.getByTestId("guest-save").click();
    await expect(page.getByTestId("account-dialog").getByTestId("signup-form")).toBeVisible();
    await page.getByTestId("account-tab-login").click();
    await expect(page.getByTestId("account-dialog").getByTestId("login-form")).toBeVisible();
    // La sesión sin cuenta funciona con la API como cualquier otra.
    expect((await context.request.post("/api/pages", { data: { title: "Borrador" } })).status()).toBe(201);
    await context.close();
  });

  test("registrarse desde el aviso conserva lo creado sin cuenta", async ({ browser }) => {
    const { context, page } = await anonymous(browser);
    await enterAsGuest(page);
    expect((await context.request.post("/api/pages", { data: { title: "Proyecto sin cuenta" } })).status()).toBe(201);
    const dialog = page.getByTestId("account-dialog");
    await dialog.getByLabel("Nombre").fill("Lucía");
    await dialog.getByLabel("Correo electrónico").fill("lucia@nodara.test");
    await dialog.getByLabel("Contraseña").fill("contraseña-segura-1");
    await dialog.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(sidebarRow(page, "Proyecto sin cuenta")).toBeVisible();
    await expect(page.getByTestId("guest-sidebar-note")).toHaveCount(0);
    const me = await (await context.request.get("/api/me")).json();
    expect(me.user).toMatchObject({ email: "lucia@nodara.test", isGuest: false });
    expect(me.workspaces[0].name).toBe("Espacio de Lucía");
    await context.close();
  });

  test("iniciar sesión desde el aviso lleva lo creado a la cuenta existente", async ({ browser }) => {
    const { context, page } = await anonymous(browser);
    await enterAsGuest(page);
    expect((await context.request.post("/api/pages", { data: { title: "Idea suelta" } })).status()).toBe(201);
    const dialog = page.getByTestId("account-dialog");
    await dialog.getByTestId("account-tab-login").click();
    await dialog.getByLabel("Correo electrónico").fill(TESTER.email);
    await dialog.getByLabel("Contraseña").fill(TESTER.password);
    await dialog.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(sidebarRow(page, "Idea suelta")).toBeVisible();
    const me = await (await context.request.get("/api/me")).json();
    expect(me.user.email).toBe(TESTER.email);
    expect(me.workspaces.map((w: { name: string }) => w.name)).toContain("Trabajo sin cuenta");
    await context.close();
  });

  test("salir del modo sin cuenta descarta los datos y vuelve a la portada", async ({ browser }) => {
    const { context, page } = await anonymous(browser);
    await enterAsGuest(page);
    await page.getByTestId("account-later").click();
    await page.getByTestId("workspace-switcher").click();
    await expect(page.getByTestId("account-email")).toHaveText("Sin cuenta");
    page.once("dialog", (d) => void d.accept());
    await page.getByTestId("logout").click();
    await expect(page).toHaveURL(/\/bienvenida$/);
    expect((await context.request.get("/api/me")).status()).toBe(401);
    await context.close();
  });

  test("las páginas de acceso ofrecen continuar sin cuenta", async ({ browser }) => {
    const { context, page } = await anonymous(browser);
    await page.goto("/login");
    await page.getByTestId("continue-as-guest").click();
    await expect(page.getByTestId("account-dialog")).toBeVisible();
    await context.close();
  });
});
