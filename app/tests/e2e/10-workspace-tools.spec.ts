import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { apiCreate, expect, gotoReady, newUser, test } from "./fixtures";

const saved = (page: Page) => expect(page.getByTestId("save-status")).toHaveText("Guardado");
const openMenu = async (page: Page) => {
  await page.getByTestId("page-more").click();
  await expect(page.getByTestId("page-menu")).toBeVisible();
};

test.describe("plantillas", () => {
  test("la galería crea una página desde una plantilla integrada", async ({ page }) => {
    await gotoReady(page, "/");
    await page.getByTestId("open-templates").click();
    await expect(page.getByTestId("templates-dialog")).toBeVisible();
    await expect(page.getByTestId("template-item")).toHaveCount(6);
    await page.getByTestId("template-item").filter({ hasText: "Notas de reunión" }).click();
    await expect(page).toHaveURL(/\/[0-9a-f-]{36}$/);
    await expect(page.getByTestId("page-title")).toHaveValue("Notas de reunión");
    await expect(page.getByTestId("editor")).toContainText("Agenda");
    await expect(page.getByTestId("callout")).toBeVisible();
  });

  test("guardar una página como plantilla y usarla después", async ({ page, request }) => {
    const doc = await apiCreate(request, { title: "Mi estructura" });
    await request.patch(`/api/pages/${doc.id}`, { data: { content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Texto reutilizable" }] }] } } });
    await gotoReady(page, `/${doc.id}`);
    await openMenu(page);
    await page.getByTestId("save-template").click();
    await page.getByLabel("Nombre de la plantilla").fill("Estructura base");
    await page.getByTestId("save-template-confirm").click();
    await expect(page.getByTestId("page-menu-message")).toHaveText("Plantilla guardada");
    await page.keyboard.press("Escape");
    await page.getByTestId("open-templates").click();
    await expect(page.getByTestId("template-item")).toHaveCount(7);
    await page.getByTestId("template-item").filter({ hasText: "Estructura base" }).click();
    await expect(page.getByTestId("editor")).toContainText("Texto reutilizable");
    await expect(page).not.toHaveURL(new RegExp(doc.id));
  });

  test("una plantilla del espacio se puede eliminar", async ({ page, request }) => {
    const doc = await apiCreate(request, { title: "Temporal" });
    await request.post("/api/page-templates", { data: { pageId: doc.id, name: "Borrable" } });
    await gotoReady(page, "/");
    await page.getByTestId("open-templates").click();
    await expect(page.getByTestId("template-item")).toHaveCount(7);
    await page.getByRole("button", { name: "Eliminar plantilla Borrable" }).click();
    await expect(page.getByTestId("template-item")).toHaveCount(6);
  });
});

test.describe("importar y exportar", () => {
  test("importar un archivo Markdown crea una página con su formato", async ({ page }) => {
    await gotoReady(page, "/");
    await page.getByTestId("open-import").click();
    await page.getByTestId("import-file").setInputFiles({ name: "notas.md", mimeType: "text/markdown", buffer: Buffer.from("# Notas importadas\n\nTexto con **negrita** y una lista:\n\n- uno\n- dos\n\n```js\nconst x = 1;\n```\n") });
    await expect(page.getByTestId("page-title")).toHaveValue("Notas importadas");
    await expect(page.getByTestId("editor").locator("strong")).toHaveText("negrita");
    await expect(page.getByTestId("editor").locator("li")).toHaveCount(2);
    await expect(page.getByTestId("editor").locator("pre")).toContainText("const x = 1;");
  });

  test("importar un CSV crea una base de datos con registros", async ({ page }) => {
    await gotoReady(page, "/");
    await page.getByTestId("open-import").click();
    await page.getByTestId("import-file").setInputFiles({ name: "tareas.csv", mimeType: "text/csv", buffer: Buffer.from("Nombre,Horas\nAlfa,3\nBeta,5\n") });
    await expect(page.getByTestId("page-title")).toHaveValue("tareas");
    await expect(page.getByTestId("db-row")).toHaveCount(2);
    await expect(page.getByText("Alfa")).toBeVisible();
  });

  test("un formato no admitido muestra un error claro", async ({ page }) => {
    await gotoReady(page, "/");
    await page.getByTestId("open-import").click();
    await page.getByTestId("import-file").setInputFiles({ name: "binario.exe", mimeType: "application/octet-stream", buffer: Buffer.from("MZ") });
    await expect(page.getByTestId("import-dialog").getByRole("alert")).toContainText("Formato no admitido");
  });

  test("exportar una página a Markdown, HTML y JSON", async ({ page, request }) => {
    const doc = await apiCreate(request, { title: "Exportable" });
    await request.patch(`/api/pages/${doc.id}`, { data: { content: { type: "doc", content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Sección" }] }, { type: "paragraph", content: [{ type: "text", text: "Contenido", marks: [{ type: "bold" }] }] }] } } });
    const md = await request.get(`/api/pages/${doc.id}/export?format=md`);
    expect(md.headers()["content-disposition"]).toContain("Exportable.md");
    expect(await md.text()).toContain("**Contenido**");
    const html = await request.get(`/api/pages/${doc.id}/export?format=html`);
    expect(await html.text()).toContain("<strong>Contenido</strong>");
    const json = await (await request.get(`/api/pages/${doc.id}/export?format=json`)).json();
    expect(json.format).toBe("nodara-page");
    expect((await request.get(`/api/pages/${doc.id}/export?format=pdf`)).status()).toBe(400);
    // y desde el menú de la página
    await gotoReady(page, `/${doc.id}`);
    await openMenu(page);
    const download = page.waitForEvent("download");
    await page.getByTestId("export-md").click();
    expect((await download).suggestedFilename()).toBe("Exportable.md");
  });

  test("exportar justo después de escribir incluye lo último escrito y los colores", async ({ page, request }) => {
    const doc = await apiCreate(request, { title: "Recién escrito" });
    await gotoReady(page, `/${doc.id}`);
    await page.getByTestId("editor").click();
    await page.keyboard.type("Texto recién tecleado");
    await openMenu(page);
    const download = page.waitForEvent("download");
    await page.getByTestId("export-md").click();
    const file = await (await download).path();
    expect(readFileSync(file!, "utf8")).toContain("Texto recién tecleado");
    // Colores a HTML con el tono fijo del tema claro
    await request.patch(`/api/pages/${doc.id}`, {
      data: { content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "rojo", marks: [{ type: "textStyle", attrs: { color: "var(--tx-red)" } }] }, { type: "text", text: "fondo", marks: [{ type: "highlight", attrs: { color: "var(--bgc-blue)" } }] }] }] } },
    });
    const html = await (await request.get(`/api/pages/${doc.id}/export?format=html`)).text();
    expect(html).toContain('<span style="color:#d44c47">rojo</span>');
    expect(html).toContain('<mark style="background-color:#e7f3f8;color:inherit">fondo</mark>');
  });

  test("exportar una base de datos como CSV", async ({ page, request }) => {
    await gotoReady(page, "/");
    await page.getByTestId("open-import").click();
    await page.getByTestId("import-file").setInputFiles({ name: "inventario.csv", mimeType: "text/csv", buffer: Buffer.from("Nombre,Cantidad\nTornillos,10\nTuercas,20\n") });
    await expect(page.getByTestId("db-row")).toHaveCount(2);
    await openMenu(page);
    const download = page.waitForEvent("download");
    await page.getByTestId("export-csv").click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("inventario.csv");
    void request;
  });

  test("quien no tiene acceso a la página no puede exportarla", async ({ browser, request }) => {
    const ana = await newUser(browser, "ana@nodara.test", "Ana");
    const doc = await apiCreate(request, { title: "Privada" });
    expect((await ana.request.get(`/api/pages/${doc.id}/export?format=md`)).status()).toBe(404);
    await ana.context.close();
  });

  test("la copia de seguridad del espacio solo la descargan propietarios y administradores", async ({ browser, request, page }) => {
    const me = { workspace: { id: (await (await request.get("/api/me")).json()).currentWorkspaceId as string } };
    const doc = await apiCreate(request, { title: "Para respaldo" });
    const backup = await request.get(`/api/workspaces/${me.workspace.id}/export`);
    expect(backup.status()).toBe(200);
    const data = await backup.json();
    expect(data.format).toBe("nodara-workspace-backup");
    expect(data.pages.map((p: { id: string }) => p.id)).toContain(doc.id);
    const ana = await newUser(browser, "ana@nodara.test", "Ana");
    expect((await ana.request.get(`/api/workspaces/${me.workspace.id}/export`)).status()).toBe(404);
    await ana.context.close();
    await gotoReady(page, "/");
    await page.getByTestId("workspace-switcher").click();
    await page.getByTestId("open-settings").click();
    await expect(page.getByTestId("export-workspace")).toBeVisible();
  });
});

test.describe("ajustes de página", () => {
  test("tipografía, texto pequeño y ancho completo se aplican y persisten", async ({ page, request }) => {
    const doc = await apiCreate(request, { title: "Estilos" });
    await gotoReady(page, `/${doc.id}`);
    const body = page.getByTestId("page-body");
    await expect(body).toHaveAttribute("data-font", "sans");
    await openMenu(page);
    await page.getByTestId("font-serif").click();
    await expect(body).toHaveAttribute("data-font", "serif");
    const family = await page.getByTestId("editor").evaluate((el) => getComputedStyle(el).fontFamily);
    expect(family).toMatch(/serif|Georgia/i);
    await page.getByTestId("toggle-small").click();
    await expect(body).toHaveAttribute("data-small", "true");
    expect(await page.getByTestId("editor").evaluate((el) => getComputedStyle(el).fontSize)).toBe("14px");
    const narrow = (await body.boundingBox())!.width;
    await page.getByTestId("toggle-wide").click();
    await expect(body).toHaveAttribute("data-wide", "true");
    expect((await body.boundingBox())!.width).toBeGreaterThan(narrow);
    await expect.poll(async () => (await (await request.get(`/api/pages/${doc.id}`)).json()).fontStyle).toBe("serif");
    await page.reload();
    await page.locator("html[data-nodara-ready]").waitFor({ state: "attached" });
    await expect(page.getByTestId("page-body")).toHaveAttribute("data-font", "serif");
    await expect(page.getByTestId("page-body")).toHaveAttribute("data-wide", "true");
  });

  test("portada: elegir un color, cambiarla por una imagen subida y quitarla", async ({ page, request }) => {
    const doc = await apiCreate(request, { title: "Con portada" });
    await gotoReady(page, `/${doc.id}`);
    await expect(page.getByTestId("page-cover")).toHaveCount(0);
    await page.getByTestId("page-title").hover();
    await page.getByTestId("add-cover").click();
    await page.getByTestId("cover-gradient:oceano").click();
    await expect(page.getByTestId("page-cover")).toBeVisible();
    await expect.poll(async () => (await (await request.get(`/api/pages/${doc.id}`)).json()).cover).toBe("gradient:oceano");
    await page.getByTestId("page-cover").hover();
    await page.getByTestId("change-cover").click();
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    await page.getByTestId("cover-file-input").setInputFiles({ name: "portada.png", mimeType: "image/png", buffer: png });
    await expect.poll(async () => (await (await request.get(`/api/pages/${doc.id}`)).json()).cover).toMatch(/^\/api\/files\//);
    await page.getByTestId("page-cover").hover();
    await page.getByTestId("remove-cover").click();
    await expect(page.getByTestId("page-cover")).toHaveCount(0);
    await expect.poll(async () => (await (await request.get(`/api/pages/${doc.id}`)).json()).cover).toBeNull();
  });

  test("la portada rechaza valores peligrosos desde la API de la interfaz", async ({ page, request }) => {
    const doc = await apiCreate(request, { title: "Portada insegura" });
    await request.patch(`/api/pages/${doc.id}`, { data: { cover: "javascript:alert(1)" } });
    await gotoReady(page, `/${doc.id}`);
    await expect(page.getByTestId("page-cover")).toHaveCount(0); // un valor no válido nunca se pinta
  });

  test("bloquear una página impide editarla y se puede desbloquear", async ({ page, request }) => {
    const doc = await apiCreate(request, { title: "Bloqueable" });
    await gotoReady(page, `/${doc.id}`);
    await page.getByTestId("editor").click();
    await page.keyboard.type("Antes del bloqueo");
    await saved(page);
    await openMenu(page);
    await page.getByTestId("toggle-lock").click();
    await expect(page.getByTestId("locked-badge")).toBeVisible();
    await expect(page.getByTestId("editor")).toHaveAttribute("contenteditable", "false");
    await expect(page.getByTestId("page-title")).toHaveJSProperty("readOnly", true);
    // el servidor también lo rechaza
    const res = await request.patch(`/api/pages/${doc.id}`, { data: { title: "Hackeado" } });
    expect(res.status()).toBe(403);
    await page.getByTestId("page-more").click();
    await page.getByTestId("toggle-lock").click();
    await expect(page.getByTestId("locked-badge")).toHaveCount(0);
    await expect(page.getByTestId("editor")).toHaveAttribute("contenteditable", "true");
    expect((await request.patch(`/api/pages/${doc.id}`, { data: { title: "Ahora sí" } })).status()).toBe(200);
  });

  test("una página bloqueada también rechaza ediciones colaborativas", async ({ request }) => {
    const doc = await apiCreate(request, { title: "Bloqueo colab" });
    await request.patch(`/api/pages/${doc.id}`, { data: { locked: true } });
    const res = await request.post(`/api/collab/${doc.id}/update`, { data: { cid: "cliente-de-prueba", update: "AAA=" } });
    expect(res.status()).toBe(403);
  });
});

test.describe("analíticas y auditoría", () => {
  test("las visitas se cuentan por persona y se muestran en el panel", async ({ page, browser, request }) => {
    const ana = await newUser(browser, "ana@nodara.test", "Ana");
    const doc = await apiCreate(request, { title: "Medida" });
    expect((await request.post(`/api/pages/${doc.id}/share`, { data: { email: "ana@nodara.test", level: "view" } })).status()).toBe(201);
    await gotoReady(page, `/${doc.id}`);
    await gotoReady(ana.page, `/${doc.id}`);
    await expect.poll(async () => (await (await request.get(`/api/pages/${doc.id}/analytics`)).json()).uniqueViewers).toBe(2);
    await openMenu(page);
    await page.getByTestId("open-analytics").click();
    await expect(page.getByTestId("analytics-panel")).toBeVisible();
    await expect(page.getByTestId("stat-unique")).toHaveText("2");
    await expect(page.getByTestId("viewers")).toContainText("Ana");
    // quien solo puede ver no accede a las estadísticas
    expect((await ana.request.get(`/api/pages/${doc.id}/analytics`)).status()).toBe(403);
    await ana.context.close();
  });

  test("la auditoría registra compartir, bloquear y exportar, y solo la ven administradores", async ({ page, browser, request }) => {
    const me = { workspace: { id: (await (await request.get("/api/me")).json()).currentWorkspaceId as string } };
    const ana = await newUser(browser, "ana@nodara.test", "Ana");
    const doc = await apiCreate(request, { title: "Auditada" });
    await request.post(`/api/pages/${doc.id}/share`, { data: { email: "ana@nodara.test", level: "edit" } });
    await request.patch(`/api/pages/${doc.id}`, { data: { locked: true } });
    await request.get(`/api/pages/${doc.id}/export?format=md`);
    const entries = await (await request.get(`/api/workspaces/${me.workspace.id}/audit`)).json();
    expect(entries.map((e: { action: string }) => e.action)).toEqual(expect.arrayContaining(["page.share", "page.lock", "page.export"]));
    expect((await ana.request.get(`/api/workspaces/${me.workspace.id}/audit`)).status()).toBe(403); // invitada al espacio, no administradora
    const csv = await request.get(`/api/workspaces/${me.workspace.id}/audit?format=csv`);
    expect(await csv.text()).toContain("Página compartida con una persona");
    await ana.context.close();
    await gotoReady(page, "/");
    await page.getByTestId("workspace-switcher").click();
    await page.getByTestId("open-settings").click();
    await page.getByTestId("settings-tab-audit").click();
    await expect(page.getByTestId("audit-row").first()).toBeVisible();
    await expect(page.getByTestId("audit-list")).toContainText("Página compartida con una persona");
  });
});

test.describe("atajos, accesibilidad y responsive", () => {
  test("Ctrl+/ abre la lista de atajos y Escape la cierra devolviendo el foco", async ({ page }) => {
    await gotoReady(page, "/");
    await page.keyboard.press("Control+/");
    await expect(page.getByTestId("shortcuts-dialog")).toBeVisible();
    await expect(page.getByTestId("shortcuts-dialog")).toContainText("Buscar páginas");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("shortcuts-dialog")).toBeHidden();
  });

  test("Ctrl+\\ oculta y muestra la barra lateral, y el estado se recuerda", async ({ page }) => {
    await gotoReady(page, "/");
    await expect(page.getByRole("complementary", { name: "Barra lateral" })).toBeVisible();
    await page.keyboard.press("Control+\\");
    await expect(page.getByRole("complementary", { name: "Barra lateral" })).toBeHidden();
    await page.reload();
    await page.locator("html[data-nodara-ready]").waitFor({ state: "attached" });
    await expect(page.getByRole("complementary", { name: "Barra lateral" })).toBeHidden();
    await page.getByTestId("sidebar-toggle").click();
    await expect(page.getByRole("complementary", { name: "Barra lateral" })).toBeVisible();
  });

  test("el botón «‹‹» oculta la barra; el de la barra superior la muestra flotando al pasar el puntero y la fija con clic", async ({ page }) => {
    await gotoReady(page, "/");
    const sidebar = page.getByRole("complementary", { name: "Barra lateral" });
    const shell = page.locator("[data-sidebar]");
    await sidebar.hover();
    await page.getByTestId("sidebar-collapse").click();
    await expect(sidebar).toBeHidden();
    await expect(shell).toHaveAttribute("data-sidebar", "closed");
    const toggle = page.getByTestId("sidebar-toggle").first();
    await toggle.hover();
    await expect(shell).toHaveAttribute("data-sidebar", "peek");
    await expect(sidebar).toBeVisible();
    await expect(page.getByTestId("sidebar-collapse")).toHaveAccessibleName("Fijar barra lateral");
    await page.mouse.move(900, 600);
    await expect(shell).toHaveAttribute("data-sidebar", "closed");
    await toggle.click();
    await expect(shell).toHaveAttribute("data-sidebar", "open");
    await expect(page.getByTestId("sidebar-collapse")).toHaveAccessibleName("Ocultar barra lateral");
  });

  test("en pantallas estrechas la barra lateral es un cajón que se cierra al navegar", async ({ page, request }) => {
    const doc = await apiCreate(request, { title: "Móvil" });
    await page.setViewportSize({ width: 390, height: 800 });
    await gotoReady(page, `/${doc.id}`);
    await expect(page.getByRole("complementary", { name: "Barra lateral" })).toBeHidden();
    await page.getByTestId("sidebar-toggle").click();
    await expect(page.getByRole("complementary", { name: "Barra lateral" })).toBeVisible();
    await page.getByRole("link", { name: "Móvil" }).first().click();
    await expect(page.getByRole("complementary", { name: "Barra lateral" })).toBeHidden();
    // sin desbordamiento horizontal de la página
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("el enlace «Saltar al contenido» lleva al contenido principal", async ({ page }) => {
    await gotoReady(page, "/");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Saltar al contenido" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main")).toBeFocused();
  });

  test("los diálogos atrapan el foco con el teclado", async ({ page }) => {
    await gotoReady(page, "/");
    await page.getByTestId("open-templates").click();
    const dialog = page.getByTestId("templates-dialog");
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
  });
});
