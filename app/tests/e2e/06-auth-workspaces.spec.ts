import type { APIRequestContext, Browser } from "@playwright/test";
import { apiCreate, expect, gotoReady, newUser, sidebarRow, TESTER, test } from "./fixtures";

const PASSWORD = "contraseña-segura-1";

/** Invita por API al usuario `other` al espacio del propietario y acepta la invitación con su sesión. */
async function join(owner: APIRequestContext, workspaceId: string, other: { request: APIRequestContext }, email: string, role: "member" | "admin" | "guest" = "member") {
  const inv = await owner.post(`/api/workspaces/${workspaceId}/invitations`, { data: { email, role } });
  expect(inv.status()).toBe(201);
  const { token } = await inv.json();
  const acc = await other.request.post(`/api/invitations/${token}/accept`);
  expect(acc.status()).toBe(200);
}

const anonymous = async (browser: Browser) => {
  const context = await browser.newContext({ baseURL: "http://127.0.0.1:3100", viewport: { width: 1440, height: 900 } });
  return { context, page: await context.newPage() };
};

test.describe("acceso", () => {
  test("sin sesión se redirige a /login conservando el destino, y la API responde 401", async ({ browser, request }) => {
    const { context, page } = await anonymous(browser);
    const created = await apiCreate(request, { title: "Privada" });
    await page.goto(`/${created.id}`);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=%2F${created.id}`));
    expect((await context.request.get("/api/pages")).status()).toBe(401);
    expect((await context.request.get(`/api/pages/${created.id}`)).status()).toBe(401);
    expect((await context.request.get("/api/me")).status()).toBe(401);
    await context.close();
  });

  test("registro: validaciones, cuenta creada, espacio propio y vuelta al destino", async ({ browser }) => {
    const { context, page } = await anonymous(browser);
    await page.goto("/signup?next=%2F");
    await page.getByLabel("Nombre").fill("Lucía");
    await page.getByLabel("Correo electrónico").fill(TESTER.email);
    await page.getByLabel("Contraseña").fill(PASSWORD);
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByTestId("auth-error")).toHaveText("Ya existe una cuenta con ese correo");
    await page.getByLabel("Correo electrónico").fill("lucia@nodara.test");
    await page.getByLabel("Contraseña").fill("corta");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    // el navegador valida minLength; la API también
    expect((await context.request.post("/api/auth/signup", { data: { email: "x@nodara.test", name: "X", password: "corta" } })).status()).toBe(400);
    await page.getByLabel("Contraseña").fill(PASSWORD);
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByTestId("workspace-name")).toHaveText("Espacio de Lucía");
    await expect(page.getByText("Aún no hay páginas")).toBeVisible();
    await context.close();
  });

  test("inicio de sesión: error genérico, éxito y cierre de sesión", async ({ browser }) => {
    const { context, page } = await anonymous(browser);
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(TESTER.email);
    await page.getByLabel("Contraseña").fill("incorrecta-123");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.getByTestId("auth-error")).toHaveText("Correo o contraseña incorrectos");
    await page.getByLabel("Correo electrónico").fill("no-existe@nodara.test");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.getByTestId("auth-error")).toHaveText("Correo o contraseña incorrectos"); // no revela si la cuenta existe
    await page.getByLabel("Correo electrónico").fill(TESTER.email);
    await page.getByLabel("Contraseña").fill(TESTER.password);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.getByTestId("workspace-switcher")).toBeVisible();
    await page.getByTestId("workspace-switcher").click();
    await page.getByTestId("logout").click();
    await expect(page).toHaveURL(/\/login/);
    expect((await context.request.get("/api/pages")).status()).toBe(401);
    await context.close();
  });

  test("la cookie de sesión es HttpOnly y no se guarda el token en claro", async ({ browser }) => {
    const { context, page } = await anonymous(browser);
    await page.goto("/login");
    await page.getByLabel("Correo electrónico").fill(TESTER.email);
    await page.getByLabel("Contraseña").fill(TESTER.password);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.getByTestId("workspace-switcher")).toBeVisible();
    const cookie = (await context.cookies()).find((c) => c.name === "nodara_session")!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("Lax");
    expect(await page.evaluate(() => document.cookie)).not.toContain("nodara_session");
    await context.close();
  });

  test("las peticiones que modifican datos desde otro origen se rechazan", async ({ request }) => {
    const res = await request.post("/api/pages", { data: {}, headers: { origin: "https://sitio-malicioso.example" } });
    expect(res.status()).toBe(403);
    expect((await request.post("/api/pages", { data: {} })).status()).toBe(201);
  });

  test("cambiar contraseña y nombre desde Configuración", async ({ page, browser }) => {
    await gotoReady(page, "/");
    await page.getByTestId("workspace-switcher").click();
    await page.getByTestId("open-settings").click();
    await page.getByTestId("settings-tab-account").click();
    await page.getByRole("textbox", { name: "Nombre", exact: true }).fill("Tester Nuevo");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByTestId("settings-status")).toHaveText("Guardado");
    await page.getByLabel("Contraseña actual").fill("mal");
    await page.getByLabel("Nueva contraseña").fill("otra-contraseña-9");
    await page.getByRole("button", { name: "Actualizar contraseña" }).click();
    await expect(page.getByTestId("settings-account").getByRole("alert")).toHaveText("La contraseña actual no es correcta");
    await page.getByLabel("Contraseña actual").fill(TESTER.password);
    await page.getByRole("button", { name: "Actualizar contraseña" }).click();
    await expect(page.getByText("Contraseña actualizada")).toBeVisible();
    const { context } = await anonymous(browser);
    expect((await context.request.post("/api/auth/login", { data: { email: TESTER.email, password: TESTER.password } })).status()).toBe(401);
    expect((await context.request.post("/api/auth/login", { data: { email: TESTER.email, password: "otra-contraseña-9" } })).status()).toBe(200);
    expect((await (await context.request.get("/api/me")).json()).user.name).toBe("Tester Nuevo");
    await context.close();
  });

  test("el limitador bloquea tras demasiados intentos fallidos", async ({ browser }) => {
    const { context } = await anonymous(browser);
    const email = "lento@nodara.test";
    const statuses: number[] = [];
    for (let i = 0; i < 10; i++) statuses.push((await context.request.post("/api/auth/login", { data: { email, password: "x-incorrecta" } })).status());
    expect(statuses.slice(0, 8).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(8)).toEqual([429, 429]);
    await context.close();
  });
});

test.describe("espacios de trabajo", () => {
  test("crear un espacio, cambiar entre espacios y aislar sus páginas", async ({ page, request }) => {
    await apiCreate(request, { title: "Solo en el primero" });
    await gotoReady(page, "/");
    await expect(sidebarRow(page, "Solo en el primero")).toBeVisible();
    await page.getByTestId("workspace-switcher").click();
    await expect(page.getByTestId("account-email")).toHaveText(TESTER.email);
    await page.getByTestId("new-workspace").click();
    await page.getByRole("textbox", { name: "Nombre del nuevo espacio" }).fill("Segundo espacio");
    await page.getByRole("button", { name: "Crear" }).click();
    await expect(page.getByTestId("workspace-name")).toHaveText("Segundo espacio");
    await expect(page.getByTestId("sidebar-page")).toHaveCount(0);
    await page.getByTestId("workspace-switcher").click();
    await expect(page.getByTestId("workspace-item")).toHaveCount(2);
    await page.getByTestId("workspace-item").filter({ hasText: "Espacio de Tester" }).click();
    await expect(sidebarRow(page, "Solo en el primero")).toBeVisible();
  });

  test("renombrar el espacio desde Configuración", async ({ page }) => {
    await gotoReady(page, "/");
    await page.getByTestId("workspace-switcher").click();
    await page.getByTestId("open-settings").click();
    await page.getByRole("textbox", { name: "Nombre del espacio de trabajo" }).fill("Mi estudio");
    await page.getByRole("button", { name: "Guardar" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("workspace-name")).toHaveText("Mi estudio");
  });

  test("invitar miembros, aceptar con enlace, cambiar rol y quitar", async ({ page, browser, request, session }) => {
    await gotoReady(page, "/");
    await page.getByTestId("workspace-switcher").click();
    await page.getByTestId("invite-members").click();
    await page.getByRole("textbox", { name: "Correo del invitado" }).fill("ana@nodara.test");
    await page.getByRole("combobox", { name: "Rol del invitado" }).selectOption("member");
    await page.getByRole("button", { name: "Invitar", exact: true }).click();
    const link = (await page.getByTestId("invite-link").textContent())!;
    expect(link).toContain("/invite/");
    await expect(page.getByTestId("pending-list")).toContainText("ana@nodara.test");

    // Ana abre el enlace sin cuenta, se registra y lo acepta
    const { context, page: ana } = await anonymous(browser);
    await ana.goto(new URL(link).pathname);
    await expect(ana.getByRole("heading", { name: /Te invitaron a Espacio de Tester/ })).toBeVisible();
    await ana.getByRole("link", { name: "Crear una cuenta" }).click();
    await ana.getByLabel("Nombre").fill("Ana");
    await ana.getByLabel("Correo electrónico").fill("ana@nodara.test");
    await ana.getByLabel("Contraseña").fill(PASSWORD);
    await ana.getByRole("button", { name: "Crear cuenta" }).click();
    await ana.getByTestId("accept-invite").click();
    await expect(ana.getByTestId("workspace-name")).toHaveText("Espacio de Tester");
    // la invitación es de un solo uso
    expect((await context.request.post(`/api/invitations/${link.split("/invite/")[1]}/accept`)).status()).toBe(410);

    // el propietario ve a Ana y le sube el rol
    await page.reload();
    await page.locator("html[data-nodara-ready]").waitFor({ state: "attached" });
    await page.getByTestId("workspace-switcher").click();
    await page.getByTestId("open-settings").click();
    await page.getByTestId("settings-tab-members").click();
    const row = page.locator('[data-testid="member-row"][data-email="ana@nodara.test"]');
    await expect(row).toBeVisible();
    await row.getByRole("combobox").selectOption("admin");
    const members = await (await request.get(`/api/workspaces/${session.workspaceId}/members`)).json();
    await expect.poll(async () => (await (await request.get(`/api/workspaces/${session.workspaceId}/members`)).json()).members.find((m: { email: string }) => m.email === "ana@nodara.test").role).toBe("admin");
    void members;
    await row.getByRole("button", { name: "Quitar a Ana" }).click();
    await expect(row).toHaveCount(0);
    expect((await ana.request.get(`/api/workspaces/${session.workspaceId}/members`)).status()).toBe(404);
    await context.close();
  });

  test("roles: un miembro no puede invitar ni gestionar, un administrador no toca a propietarios", async ({ browser, request, session }) => {
    const ana = await newUser(browser, "ana@nodara.test");
    const bob = await newUser(browser, "bob@nodara.test");
    await join(request, session.workspaceId, ana, "ana@nodara.test", "member");
    await join(request, session.workspaceId, bob, "bob@nodara.test", "admin");
    const anaInvite = await ana.request.post(`/api/workspaces/${session.workspaceId}/invitations`, { data: { email: "x@nodara.test", role: "member" } });
    expect(anaInvite.status()).toBe(403);
    const me = await (await request.get("/api/me")).json();
    expect((await bob.request.patch(`/api/workspaces/${session.workspaceId}/members/${me.user.id}`, { data: { role: "member" } })).status()).toBe(403);
    expect((await request.patch(`/api/workspaces/${session.workspaceId}/members/${me.user.id}`, { data: { role: "member" } })).status()).toBe(409); // último propietario
    expect((await ana.request.delete(`/api/workspaces/${session.workspaceId}`)).status()).toBe(403);
    await ana.context.close();
    await bob.context.close();
  });
});

test.describe("permisos de páginas", () => {
  test("las páginas son privadas por defecto y «Espacio de equipo» las abre a los miembros", async ({ page, browser, request, session }) => {
    const ana = await newUser(browser, "ana@nodara.test", "Ana");
    await join(request, session.workspaceId, ana, "ana@nodara.test");
    const secret = await apiCreate(request, { title: "Plan secreto" });
    await gotoReady(ana.page, "/");
    await expect(sidebarRow(ana.page, "Plan secreto")).toHaveCount(0);
    expect((await ana.request.get(`/api/pages/${secret.id}`)).status()).toBe(404); // ni siquiera revela que existe

    await gotoReady(page, `/${secret.id}`);
    await page.getByTestId("share-btn").click();
    await expect(page.getByTestId("general-access")).toHaveValue("private");
    await page.getByTestId("general-access").selectOption("workspace");
    await expect(page.getByTestId("privacy-indicator")).toContainText("Espacio de equipo");
    await ana.page.reload();
    await ana.page.locator("html[data-nodara-ready]").waitFor({ state: "attached" });
    await expect(ana.page.getByTestId("section-team").getByTestId("sidebar-page").filter({ hasText: "Plan secreto" })).toBeVisible();

    // Ana edita y el cambio llega al autor
    await ana.page.getByTestId("section-team").getByText("Plan secreto").click();
    await expect(ana.page.getByTestId("page-title")).toBeEditable();
    await ana.page.getByTestId("editor").click();
    await ana.page.keyboard.type("Aporte de Ana");
    await expect(ana.page.getByTestId("save-status")).toHaveText("Guardado");
    await page.reload();
    await expect(page.getByTestId("editor")).toContainText("Aporte de Ana");

    await page.getByTestId("share-btn").click();
    await page.getByTestId("general-access").selectOption("private");
    expect((await ana.request.get(`/api/pages/${secret.id}`)).status()).toBe(404);
    await ana.context.close();
  });

  test("compartir por correo con nivel «Puede ver»: solo lectura real en interfaz y servidor", async ({ page, browser, request }) => {
    const ana = await newUser(browser, "ana@nodara.test", "Ana");
    const doc = await apiCreate(request, { title: "Informe" });
    await request.patch(`/api/pages/${doc.id}`, { data: { content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Contenido original" }] }] } } });
    await gotoReady(page, `/${doc.id}`);
    await page.getByTestId("share-btn").click();
    await page.getByTestId("share-email").fill("ana@nodara.test");
    await page.getByRole("combobox", { name: "Nivel de acceso a conceder" }).selectOption("view");
    await page.getByTestId("share-submit").click();
    await expect(page.getByTestId("share-person").filter({ hasText: "Ana" })).toBeVisible();

    await gotoReady(ana.page, "/");
    await expect(ana.page.getByTestId("section-shared").getByText("Informe")).toBeVisible();
    await ana.page.getByTestId("section-shared").getByText("Informe").click();
    await expect(ana.page.getByTestId("readonly-badge")).toHaveText("Solo lectura");
    await expect(ana.page.getByTestId("page-title")).not.toBeEditable();
    await expect(ana.page.getByTestId("editor")).toHaveAttribute("contenteditable", "false");
    expect((await ana.request.patch(`/api/pages/${doc.id}`, { data: { title: "hackeado" } })).status()).toBe(403);
    expect((await ana.request.delete(`/api/pages/${doc.id}`)).status()).toBe(403);

    // el autor sube el nivel a «Puede editar» y Ana ya puede escribir
    await page.getByRole("combobox", { name: "Acceso de Ana" }).selectOption("edit");
    await ana.page.reload();
    await ana.page.locator("html[data-nodara-ready]").waitFor({ state: "attached" });
    await expect(ana.page.getByTestId("page-title")).toBeEditable();
    expect((await ana.request.patch(`/api/pages/${doc.id}`, { data: { title: "Informe v2" } })).status()).toBe(200);

    // y retirar el acceso la deja fuera
    await page.getByRole("combobox", { name: "Acceso de Ana" }).selectOption("none");
    expect((await ana.request.get(`/api/pages/${doc.id}`)).status()).toBe(404);
    await ana.context.close();
  });

  test("compartir con un correo sin cuenta genera un enlace de invitación", async ({ page, request }) => {
    const doc = await apiCreate(request, { title: "Para alguien nuevo" });
    await gotoReady(page, `/${doc.id}`);
    await page.getByTestId("share-btn").click();
    await page.getByTestId("share-email").fill("nuevo@nodara.test");
    await page.getByTestId("share-submit").click();
    await expect(page.getByTestId("share-invite-link")).toContainText("/invite/");
  });

  test("los permisos de una base de datos limitan la edición de celdas, filas y vistas", async ({ browser, request }) => {
    const ana = await newUser(browser, "ana@nodara.test", "Ana");
    const db = await (await request.post("/api/databases", { data: {} })).json();
    await request.patch(`/api/pages/${db.page.id}`, { data: { title: "Tareas" } });
    const prop = await (await request.post(`/api/databases/${db.collection.id}/properties`, { data: { name: "Horas", type: "number" } })).json();
    await request.post(`/api/databases/${db.collection.id}/records`, { data: { title: "Fila", properties: { [prop.id]: 3 } } });
    const share = await request.post(`/api/pages/${db.page.id}/share`, { data: { email: "ana@nodara.test", level: "view" } });
    expect(share.status()).toBe(201);

    await gotoReady(ana.page, `/${db.page.id}`);
    await expect(ana.page.getByTestId("db-row")).toHaveCount(1);
    await expect(ana.page.getByTestId("new-btn")).toHaveCount(0);
    await expect(ana.page.getByTestId("add-row")).toHaveCount(0);
    await expect(ana.page.getByTestId("add-prop")).toHaveCount(0);
    await expect(ana.page.getByTestId("cell")).not.toHaveAttribute("role", "button");
    expect((await ana.request.patch(`/api/records/${(await (await request.post(`/api/databases/${db.collection.id}/query`, { data: {} })).json()).rows[0].id}`, { data: { title: "x" } })).status()).toBe(403);
    expect((await ana.request.post(`/api/databases/${db.collection.id}/properties`, { data: { name: "X", type: "text" } })).status()).toBe(403);
    // sí puede explorar: filtrar y ordenar solo en su navegador
    await ana.page.getByTestId("col-header").filter({ hasText: "Horas" }).click();
    await ana.page.getByTestId("sort-desc").click();
    const views = (await (await request.post(`/api/databases/${db.collection.id}/query`, { data: {} })).json()).bundle.views;
    expect(views[0].config.sorts).toBeUndefined();
    await ana.context.close();
  });

  test("favoritos por usuario", async ({ page, browser, request, session }) => {
    const ana = await newUser(browser, "ana@nodara.test", "Ana");
    await join(request, session.workspaceId, ana, "ana@nodara.test");
    const doc = await apiCreate(request, { title: "Compartida" });
    await request.put(`/api/pages/${doc.id}/scope`, { data: { scope: "workspace" } });
    await gotoReady(page, `/${doc.id}`);
    await page.getByRole("button", { name: "Añadir a favoritos" }).click();
    await expect(page.getByTestId("favorite-page")).toContainText("Compartida");
    await gotoReady(ana.page, `/${doc.id}`);
    await expect(ana.page.getByTestId("favorite-page")).toHaveCount(0);
    await ana.context.close();
  });

  test("aislamiento entre espacios: una página de otro espacio no existe para ti", async ({ browser, request }) => {
    const eve = await newUser(browser, "eve@nodara.test", "Eve");
    const doc = await apiCreate(request, { title: "De Tester" });
    expect((await eve.request.get(`/api/pages/${doc.id}`)).status()).toBe(404);
    expect((await eve.request.post("/api/pages", { data: { parentId: doc.id } })).status()).toBe(404);
    expect((await eve.request.get(`/api/search?q=Tester`)).status()).toBe(200);
    expect(await (await eve.request.get(`/api/search?q=Tester`)).json()).toHaveLength(0);
    await eve.context.close();
  });
});

test.describe("publicar en la web", () => {
  test("enlace público de lectura: se abre sin sesión, no permite editar y se puede retirar", async ({ page, browser, request }) => {
    const doc = await apiCreate(request, { title: "Pública" });
    await request.patch(`/api/pages/${doc.id}`, { data: { icon: "🌍", content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hola mundo" }] }] } } });
    await gotoReady(page, `/${doc.id}`);
    await page.getByTestId("share-btn").click();
    await page.getByTestId("share-tab-publish").click();
    await page.getByTestId("publish-switch").click();
    await expect(page.getByTestId("publish-switch")).toBeChecked();
    const url = (await page.getByTestId("public-url").textContent())!;
    expect(url).toContain("/s/");

    const { context, page: visitor } = await anonymous(browser);
    await visitor.goto(new URL(url).pathname);
    await expect(visitor.getByTestId("public-title")).toHaveText("Pública");
    await expect(visitor.getByTestId("editor")).toContainText("Hola mundo");
    await expect(visitor.getByTestId("editor")).toHaveAttribute("contenteditable", "false");
    const token = url.split("/s/")[1];
    expect((await context.request.patch(`/api/public/${token}/pages/${doc.id}`, { data: { title: "x" } })).status()).toBe(403);
    expect((await context.request.get(`/api/pages/${doc.id}`)).status()).toBe(401); // el enlace no abre la API privada

    await page.getByTestId("publish-switch").click();
    await expect(page.getByTestId("publish-switch")).not.toBeChecked();
    await visitor.reload();
    await expect(visitor.getByTestId("public-missing")).toBeVisible();
    await context.close();
  });

  test("enlace público con permiso de edición", async ({ page, browser, request }) => {
    const doc = await apiCreate(request, { title: "Editable por todos" });
    await gotoReady(page, `/${doc.id}`);
    await page.getByTestId("share-btn").click();
    await page.getByTestId("share-tab-publish").click();
    await page.getByTestId("publish-switch").click();
    await expect(page.getByTestId("publish-switch")).toBeChecked();
    await page.getByTestId("publish-level").selectOption("edit");
    await expect(page.getByTestId("publish-level")).toHaveValue("edit");
    const token = (await page.getByTestId("public-url").textContent())!.split("/s/")[1];
    const { context, page: visitor } = await anonymous(browser);
    await visitor.goto(`/s/${token}`);
    await expect(visitor.getByTestId("editor")).toHaveAttribute("contenteditable", "true");
    await visitor.getByTestId("editor").click();
    await visitor.keyboard.type("Texto anónimo");
    await expect(visitor.getByRole("status")).toHaveText("Guardado");
    expect((await (await request.get(`/api/pages/${doc.id}`)).json()).contentText).toBe("Texto anónimo");
    await context.close();
  });

  test("un enlace público cubre solo el subárbol publicado", async ({ browser, request }) => {
    const root = await apiCreate(request, { title: "Raíz" });
    const child = await apiCreate(request, { title: "Hija", parentId: root.id });
    const other = await apiCreate(request, { title: "Ajena" });
    const { token } = await (await request.post(`/api/pages/${root.id}/publish`, { data: { level: "view" } })).json();
    const { context } = await anonymous(browser);
    expect((await context.request.get(`/api/public/${token}`)).status()).toBe(200);
    expect((await context.request.get(`/api/public/${token}?page=${child.id}`)).status()).toBe(200);
    expect((await context.request.get(`/api/public/${token}?page=${other.id}`)).status()).toBe(404);
    expect((await context.request.get(`/api/public/token-falso`)).status()).toBe(404);
    await context.close();
  });
});

test.describe("historial de versiones", () => {
  test("se guardan versiones al editar, se previsualizan y se restauran", async ({ page, request }) => {
    const doc = await apiCreate(request, { title: "Documento" });
    await gotoReady(page, `/${doc.id}`);
    await page.getByTestId("editor").click();
    await page.keyboard.type("Primera versión");
    await expect(page.getByTestId("save-status")).toHaveText("Guardado");
    await page.keyboard.type(" y segunda");
    await expect(page.getByTestId("save-status")).toHaveText("Guardado");
    await expect.poll(async () => (await (await request.get(`/api/pages/${doc.id}/versions`)).json()).length).toBeGreaterThanOrEqual(2);
    await page.getByTestId("page-more").click();
    await page.getByTestId("open-history").click();
    const items = page.getByTestId("version-item");
    await expect(items.first()).toBeVisible();
    // la versión más antigua contiene solo el primer texto
    await items.last().click();
    await expect(page.getByTestId("version-preview")).toContainText("Primera versión");
    await expect(page.getByTestId("version-preview")).not.toContainText("segunda");
    await page.getByTestId("restore-version").click();
    await page.locator("html[data-nodara-ready]").waitFor({ state: "attached" });
    await expect(page.getByTestId("editor")).toContainText("Primera versión");
    await expect(page.getByTestId("editor")).not.toContainText("segunda");
  });
});
