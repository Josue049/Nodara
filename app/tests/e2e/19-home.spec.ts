import { apiCreate, apiDatabase, expect, gotoReady, newUser, sidebarRow, test } from "./fixtures";

// Capturas del panel para revisión visual (fuera de app/, junto al resto de resultados de Playwright).
const SHOTS = "../.data/home-shots";

test.describe("panel de inicio", () => {
  test("muestra saludo, contadores y recientes con datos reales; las tarjetas navegan", async ({ page, request }) => {
    const plan = await apiCreate(request, { title: "Plan de proyecto", icon: "🚀" });
    await apiCreate(request, { title: "Notas de reunión", parentId: plan.id });
    await apiCreate(request, { title: "Ideas" });
    await apiDatabase(request, "Tareas del equipo");
    await request.patch(`/api/pages/${plan.id}`, { data: { isFavorite: true, cover: "gradient:lavanda" } });
    // Visitar «Ideas» la pone la primera entre las recientes.
    const ideas = (await (await request.get("/api/pages")).json()).find((p: { title: string }) => p.title === "Ideas");
    await request.post(`/api/pages/${ideas.id}/analytics`);

    await gotoReady(page, "/");
    await expect(page.getByTestId("home-greeting")).toContainText(/Buen(os|as) (días|tardes|noches), Tester/);
    await expect(page.getByTestId("stat-pages-value")).toHaveText("3");
    await expect(page.getByTestId("stat-databases-value")).toHaveText("1");
    await expect(page.getByTestId("stat-edited-value")).toHaveText("4");
    await expect(page.getByTestId("stat-members-value")).toHaveText("1");

    const cards = page.getByTestId("home-recent-card");
    await expect(cards).toHaveCount(4);
    await expect(cards.first()).toContainText("Ideas");
    await expect(cards.first()).toContainText("Visitada");
    await expect(cards.filter({ hasText: "Notas de reunión" })).toContainText("Plan de proyecto"); // ruta del padre
    await expect(page.getByTestId("home-hero")).toContainText("3 páginas");
    await page.screenshot({ path: `${SHOTS}/home-light.png` });
    await page.getByTestId("home-spaces").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/home-light-spaces.png` });

    await cards.filter({ hasText: "Notas de reunión" }).click();
    await expect(page.getByTestId("page-title")).toHaveValue("Notas de reunión");
  });

  test("crear página y base de datos desde la panorámica", async ({ page }) => {
    await gotoReady(page, "/");
    await expect(page.getByTestId("home-empty")).toContainText("Aún no hay páginas");
    await page.getByTestId("home-create-page").click();
    await expect(page).toHaveURL(/\/[0-9a-f-]{36}$/);
    await page.getByTestId("page-title").fill("Desde el inicio");
    await expect(page.getByTestId("save-status")).toHaveText("Guardado");
    await page.getByRole("link", { name: "Inicio", exact: true }).click();
    await expect(page.getByTestId("home-recent-card").first()).toContainText("Desde el inicio");

    await page.getByTestId("home-create-database").click();
    await expect(page.getByTestId("database")).toBeVisible();
    await page.goto("/");
    await expect(page.getByTestId("stat-databases-value")).toHaveText("1");
  });

  test("contador de miembros abre la configuración y «Ver todo» abre la búsqueda", async ({ page, request }) => {
    await apiCreate(request, { title: "Algo" });
    await gotoReady(page, "/");
    await page.getByTestId("stat-members").getByRole("button").click();
    await expect(page.getByTestId("settings-dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Ver todo" }).click();
    await expect(page.getByTestId("search-dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByTestId("home-search").click();
    await expect(page.getByTestId("search-dialog")).toBeVisible();
  });

  test("espacios de trabajo: crear uno nuevo y volver al anterior desde la cuadrícula", async ({ page, request }) => {
    await apiCreate(request, { title: "Página del primero" });
    await gotoReady(page, "/");
    await expect(page.getByTestId("home-space")).toHaveCount(1);
    await expect(page.getByTestId("home-space").first()).toContainText("Actual");
    await page.getByTestId("home-new-space").click();
    await page.getByLabel("Nombre del espacio").fill("Segundo espacio");
    await page.getByRole("button", { name: "Crear", exact: true }).click();
    await page.locator("html[data-nodara-ready]").waitFor({ state: "attached" });
    await expect(page.getByTestId("workspace-name")).toHaveText("Segundo espacio");
    await expect(page.getByTestId("home-space")).toHaveCount(2);
    await expect(page.getByTestId("home-empty")).toBeVisible();

    await page.getByRole("button", { name: /^Cambiar a / }).click();
    await page.locator("html[data-nodara-ready]").waitFor({ state: "attached" });
    await expect(page.getByTestId("workspace-name")).not.toHaveText("Segundo espacio");
    await expect(sidebarRow(page, "Página del primero")).toBeVisible();
  });

  test("tema oscuro y móvil: sin desbordamiento horizontal", async ({ page, request }) => {
    for (const title of ["Hoja de ruta", "Diario", "Lecturas", "Presupuesto 2027"]) await apiCreate(request, { title });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.addInitScript(() => localStorage.setItem("nodara:theme", "dark"));
    await gotoReady(page, "/");
    await expect(page.getByTestId("home-recent-card")).toHaveCount(4);
    await page.screenshot({ path: `${SHOTS}/home-dark.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoReady(page, "/");
    await expect(page.getByTestId("home-hero")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `${SHOTS}/home-mobile.png` });
  });

  test("un invitado no ve los botones de crear en la raíz", async ({ request, browser, session }) => {
    const inv = await request.post(`/api/workspaces/${session.workspaceId}/invitations`, { data: { email: "invitada@nodara.test", role: "guest" } });
    expect(inv.status()).toBe(201);
    const { token } = await inv.json();
    const guest = await newUser(browser, "invitada@nodara.test");
    expect((await guest.request.post(`/api/invitations/${token}/accept`)).status()).toBe(200);
    await gotoReady(guest.page, "/");
    await expect(guest.page.getByText("Como invitado no puedes crear páginas")).toBeVisible();
    await expect(guest.page.getByTestId("home-create-page")).toHaveCount(0);
    await guest.context.close();
  });

  test("el logo vuelve a Inicio sin recargar la aplicación", async ({ page, request }) => {
    const doc = await apiCreate(request, { title: "Lejos de casa" });
    await gotoReady(page, `/${doc.id}`);
    await page.evaluate(() => ((window as unknown as { __nd: number }).__nd = 42));
    await page.getByTestId("sidebar-brand").click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("home-dashboard")).toBeVisible();
    // Misma ventana JS: navegación del cliente, no recarga completa.
    expect(await page.evaluate(() => (window as unknown as { __nd?: number }).__nd)).toBe(42);
  });

  test("tema: barra lateral, logo, favicon y banner siguen al tema y persisten", async ({ page, context }) => {
    await gotoReady(page, "/");
    await page.evaluate(() => localStorage.setItem("nodara:theme", "light"));
    await page.reload();
    await page.locator("html[data-nodara-ready]").waitFor({ state: "attached" });
    const look = () =>
      page.evaluate(() => {
        const vis = (sel: string) => getComputedStyle(document.querySelector(sel)!).display !== "none";
        return {
          theme: document.documentElement.dataset.theme,
          sidebar: getComputedStyle(document.querySelector("aside.nd-sidebar")!).backgroundColor,
          light: vis('[data-testid="sidebar-brand"] img.nd-only-light'),
          dark: vis('[data-testid="sidebar-brand"] img.nd-only-dark'),
          icons: [...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')].map((l) => new URL(l.href).pathname),
          ink: getComputedStyle(document.querySelector('[data-testid="home-greeting"]')!).color,
        };
      });
    const light = await look();
    expect(light).toMatchObject({ theme: "light", sidebar: "rgb(249, 248, 247)", light: true, dark: false, ink: "rgb(20, 21, 46)" });
    expect(light.icons.length).toBeGreaterThan(0);
    expect(light.icons.every((h) => h === "/brand/favicon-light-32.png")).toBe(true);
    await page.screenshot({ path: `${SHOTS}/theme-light.png` });

    await page.getByTestId("theme-toggle").click();
    await expect.poll(async () => (await look()).theme).toBe("dark");
    const dark = await look();
    expect(dark).toMatchObject({ sidebar: "rgb(32, 32, 32)", light: false, dark: true, ink: "rgb(255, 255, 255)" });
    expect(dark.icons.every((h) => h === "/brand/favicon-dark-32.png")).toBe(true);
    // Las tarjetas terminan su transición en el color de superficie oscuro (sin colores fijos del tema claro).
    await expect.poll(() => page.getByTestId("stat-pages").locator("div").first().evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(18, 22, 42)");
    await page.screenshot({ path: `${SHOTS}/theme-dark.png` });

    // Persiste al recargar y al navegar.
    await page.reload();
    await page.locator("html[data-nodara-ready]").waitFor({ state: "attached" });
    expect((await look()).theme).toBe("dark");
    expect((await look()).icons.every((h) => h === "/brand/favicon-dark-32.png")).toBe(true);

    // Otra pestaña que vuelve al claro sincroniza esta sin recargar.
    const other = await context.newPage();
    await gotoReady(other, "/");
    await other.getByTestId("theme-toggle").click();
    await expect.poll(async () => (await look()).theme).toBe("light");
    expect((await look()).icons.every((h) => h === "/brand/favicon-light-32.png")).toBe(true);
    await other.close();
  });

  test("login y registro muestran el isotipo oficial según el tema", async ({ browser }) => {
    for (const theme of ["light", "dark"] as const) {
      const context = await browser.newContext({ baseURL: "http://127.0.0.1:3100", colorScheme: theme });
      const page = await context.newPage();
      for (const path of ["/login", "/signup"]) {
        await page.goto(path);
        const logo = page.getByTestId("auth-logo");
        await expect(logo.locator(`img.nd-only-${theme}`)).toBeVisible();
        await expect(logo.locator(`img.nd-only-${theme === "light" ? "dark" : "light"}`)).toBeHidden();
        await expect(logo).not.toContainText("N");
        expect(await logo.locator(`img.nd-only-${theme}`).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
        await page.screenshot({ path: `${SHOTS}/auth${path.replace("/", "-")}-${theme}.png` });
      }
      await context.close();
    }
  });
});
