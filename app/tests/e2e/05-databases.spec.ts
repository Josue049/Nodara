import type { Page } from "@playwright/test";
import { apiDatabase, apiProp, apiQuery, apiRow, dbRows, expect, gotoReady, rowByTitle, test } from "./fixtures";

const today = () => new Date().toISOString().slice(0, 10);

/** Base con Estado, Horas y Vence, más tres filas con estados distintos. */
async function seedTasks(request: Parameters<typeof apiDatabase>[0]) {
  const db = await apiDatabase(request, "Tareas");
  const status = await apiProp(request, db.cid, { name: "Estado", type: "status" });
  const hours = await apiProp(request, db.cid, { name: "Horas", type: "number" });
  const due = await apiProp(request, db.cid, { name: "Vence", type: "date" });
  const q = await apiQuery(request, db.cid);
  void q;
  const a = await apiRow(request, db.cid, { title: "Alfa", properties: { [status.id]: "todo", [hours.id]: 3, [due.id]: { start: today() } } });
  const b = await apiRow(request, db.cid, { title: "Beta", properties: { [status.id]: "doing", [hours.id]: 5, [due.id]: { start: today() } } });
  const c = await apiRow(request, db.cid, { title: "Gamma", properties: { [status.id]: "done", [hours.id]: 1 } });
  return { ...db, status, hours, due, a, b, c };
}

const titlesOf = (page: Page) => page.getByTestId("row-title").allTextContents();

test("crear una base desde la barra lateral, añadir filas y persistir", async ({ page }) => {
  await gotoReady(page, "/");
  await page.getByTestId("new-database").click({ force: true });
  await expect(page.getByTestId("database")).toBeVisible();
  await expect(page.getByTestId("col-header").first()).toHaveText("Nombre");
  await expect(page.getByTestId("view-tab")).toHaveText("Tabla");
  await page.getByTestId("page-title").fill("Mis tareas");
  await page.getByTestId("add-row").click();
  await expect(page.getByRole("textbox", { name: "Título", exact: true })).toBeFocused();
  await page.keyboard.type("Primera fila");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("row-title")).toHaveText("Primera fila");
  await expect(page.getByTestId("save-status")).toHaveText("Guardado");
  await page.reload();
  await page.locator("html[data-nodara-ready]").waitFor({ state: "attached" });
  await expect(page.getByTestId("row-title")).toHaveText("Primera fila");
  await expect(page.getByTestId("page-title")).toHaveValue("Mis tareas");
  await expect(page.getByTestId("sidebar-page").filter({ hasText: "Mis tareas" })).toBeVisible();
});

test("propiedad numérica: crear, editar celda y calcular suma en el pie", async ({ page, request }) => {
  const db = await apiDatabase(request);
  await apiRow(request, db.cid, { title: "Uno" });
  await apiRow(request, db.cid, { title: "Dos" });
  await gotoReady(page, `/${db.pageId}`);
  await page.getByTestId("add-prop").click();
  await page.getByTestId("type-number").click();
  await expect(page.getByTestId("col-header").nth(1)).toHaveText("Número");
  const cells = (title: string) => rowByTitle(page, title).getByTestId("cell");
  await cells("Uno").click();
  await page.keyboard.type("4,5");
  await page.keyboard.press("Enter");
  await cells("Dos").click();
  await page.keyboard.type("10");
  await page.keyboard.press("Enter");
  await expect(cells("Uno")).toHaveText("4,5");
  await page.getByTestId("col-header").nth(1).click();
  await page.getByTestId("calc-open").click();
  await page.getByRole("button", { name: "Suma" }).click();
  await expect(page.getByTestId("calc-value")).toHaveText("14,5");
  await page.reload();
  await page.locator("html[data-nodara-ready]").waitFor({ state: "attached" });
  await expect(page.getByTestId("calc-value")).toHaveText("14,5");
  const q = await apiQuery(request, db.cid);
  expect(q.rows.map((r) => Object.values(r.values)[0]).sort()).toEqual([10, 4.5]);
});

test("estado y selección: elegir opciones y crear una nueva desde la celda", async ({ page, request }) => {
  const db = await apiDatabase(request);
  const status = await apiProp(request, db.cid, { name: "Estado", type: "status" });
  const tag = await apiProp(request, db.cid, { name: "Etiqueta", type: "select" });
  await apiRow(request, db.cid, { title: "Fila" });
  await gotoReady(page, `/${db.pageId}`);
  const row = rowByTitle(page, "Fila");
  await row.getByTestId("cell").nth(0).click();
  await page.getByTestId("option-item").filter({ hasText: "En curso" }).click();
  await expect(row.getByTestId("cell").nth(0)).toContainText("En curso");
  await row.getByTestId("cell").nth(1).click();
  await page.getByRole("textbox", { name: "Buscar o crear una opción…" }).fill("Importante");
  await page.getByTestId("create-option").click();
  await expect(row.getByTestId("cell").nth(1)).toContainText("Importante");
  const q = await apiQuery(request, db.cid);
  expect(q.rows[0].values[status.id]).toBe("doing");
  expect(typeof q.rows[0].values[tag.id]).toBe("string");
});

test("filtros: aplicar, persistir en la vista y quitar", async ({ page, request }) => {
  const db = await seedTasks(request);
  await gotoReady(page, `/${db.pageId}`);
  await expect(dbRows(page)).toHaveCount(3);
  await page.getByTestId("filter-btn").click();
  await page.getByTestId("add-filter").click();
  await page.getByRole("combobox", { name: "Propiedad del filtro" }).selectOption({ label: "Estado" });
  await page.getByRole("combobox", { name: "Valor del filtro" }).selectOption({ label: "Listo" });
  await expect(dbRows(page)).toHaveCount(1);
  await expect(page.getByTestId("row-title")).toHaveText("Gamma");
  await page.keyboard.press("Escape");
  await page.reload();
  await page.locator("html[data-nodara-ready]").waitFor({ state: "attached" });
  await expect(dbRows(page)).toHaveCount(1);
  await expect(page.getByTestId("filter-btn")).toContainText("1");
  await page.getByTestId("filter-btn").click();
  await page.getByRole("button", { name: "Quitar filtro" }).click();
  await expect(dbRows(page)).toHaveCount(3);
});

test("filtro numérico y de fecha relativa", async ({ page, request }) => {
  const db = await seedTasks(request);
  await gotoReady(page, `/${db.pageId}`);
  await page.getByTestId("filter-btn").click();
  await page.getByTestId("add-filter").click();
  await page.getByRole("combobox", { name: "Propiedad del filtro" }).selectOption({ label: "Horas" });
  await page.getByRole("combobox", { name: "Operador" }).selectOption({ label: ">" });
  await page.getByRole("spinbutton", { name: "Valor del filtro" }).fill("2");
  await expect(dbRows(page)).toHaveCount(2);
  await page.getByRole("button", { name: "Quitar filtro" }).click();
  await page.getByTestId("add-filter").click();
  await page.getByRole("combobox", { name: "Propiedad del filtro" }).selectOption({ label: "Vence" });
  await expect(dbRows(page)).toHaveCount(2); // «es hoy» por defecto: Alfa y Beta
});

test("ordenar desde el encabezado y desde el menú de orden", async ({ page, request }) => {
  const db = await seedTasks(request);
  await gotoReady(page, `/${db.pageId}`);
  await page.getByTestId("col-header").filter({ hasText: "Horas" }).click();
  await page.getByTestId("sort-desc").click();
  await expect.poll(() => titlesOf(page)).toEqual(["Beta", "Alfa", "Gamma"]);
  await page.getByTestId("sort-btn").click();
  await page.getByRole("combobox", { name: "Dirección" }).selectOption("asc");
  await expect.poll(() => titlesOf(page)).toEqual(["Gamma", "Alfa", "Beta"]);
  await page.keyboard.press("Escape");
  await page.reload();
  await page.locator("html[data-nodara-ready]").waitFor({ state: "attached" });
  await expect.poll(() => titlesOf(page)).toEqual(["Gamma", "Alfa", "Beta"]);
});

test("agrupar la tabla por estado muestra grupos con conteo", async ({ page, request }) => {
  const db = await seedTasks(request);
  await gotoReady(page, `/${db.pageId}`);
  await page.getByTestId("col-header").filter({ hasText: "Estado" }).click();
  await page.getByTestId("group-by").click();
  await expect(page.getByTestId("group")).toHaveCount(4); // 3 estados + «Sin Estado»
  await expect(page.locator('[data-group="doing"]').getByTestId("group-count")).toHaveText("1");
  await page.getByTestId("settings-btn").click();
  await page.getByRole("switch", { name: "Ocultar grupos vacíos" }).check();
  await expect(page.getByTestId("group")).toHaveCount(3);
});

test("tablero: columnas por estado y arrastrar una tarjeta cambia el valor", async ({ page, request }) => {
  const db = await seedTasks(request);
  await gotoReady(page, `/${db.pageId}`);
  await page.getByTestId("add-view").click();
  await page.getByTestId("add-view-board").click();
  await expect(page.getByTestId("board-column")).toHaveCount(4);
  const todo = page.locator('[data-testid="board-column"][data-group="todo"]');
  const done = page.locator('[data-testid="board-column"][data-group="done"]');
  await expect(todo.getByTestId("board-card")).toHaveCount(1);
  const card = todo.getByTestId("board-card");
  const from = (await card.boundingBox())!;
  const to = (await done.boundingBox())!;
  await page.mouse.move(from.x + 40, from.y + 10);
  await page.mouse.down();
  await page.mouse.move(from.x + 60, from.y + 30, { steps: 4 });
  await page.mouse.move(to.x + 100, to.y + 60, { steps: 10 });
  await page.mouse.up();
  await expect(done.getByTestId("board-card")).toHaveCount(2);
  await expect(todo.getByTestId("board-card")).toHaveCount(0);
  const q = await apiQuery(request, db.cid);
  expect(q.rows.find((r) => r.id === db.a.id)!.values[db.status.id]).toBe("done");
  // añadir tarjeta a una columna fija su estado
  await done.getByTestId("board-add").click();
  await expect(done.getByTestId("board-card")).toHaveCount(3);
});

test("calendario: eventos en su día y mover con arrastrar y soltar", async ({ page, request }) => {
  const db = await seedTasks(request);
  await gotoReady(page, `/${db.pageId}`);
  await page.getByTestId("add-view").click();
  await page.getByTestId("add-view-calendar").click();
  const todayCell = page.locator(`[data-testid="calendar-day"][data-day="${today()}"]`);
  await expect(todayCell.getByTestId("calendar-chip")).toHaveCount(2);
  const target = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
  const targetCell = page.locator(`[data-testid="calendar-day"][data-day="${target}"]`);
  if ((await targetCell.count()) === 0) test.skip(true, "El día destino queda fuera del mes visible");
  const chip = todayCell.getByTestId("calendar-chip").first();
  const rowId = (await chip.getAttribute("data-row-id"))!;
  const a = (await chip.boundingBox())!;
  const b = (await targetCell.boundingBox())!;
  await page.mouse.move(a.x + 10, a.y + 8);
  await page.mouse.down();
  await page.mouse.move(a.x + 20, a.y + 20, { steps: 4 });
  await page.mouse.move(b.x + 40, b.y + 40, { steps: 10 });
  await page.mouse.up();
  await expect(targetCell.getByTestId("calendar-chip")).toHaveCount(1);
  const q = await apiQuery(request, db.cid);
  expect((q.rows.find((r) => r.id === rowId)!.values[db.due.id] as { start: string }).start).toBe(target);
});

test("galería, lista y cronograma muestran las filas y se pueden añadir", async ({ page, request }) => {
  const db = await seedTasks(request);
  await gotoReady(page, `/${db.pageId}`);
  for (const [type, testId, card] of [["gallery", "gallery-view", "gallery-card"], ["list", "list-view", "list-row"], ["timeline", "timeline-view", "timeline-row"]] as const) {
    await page.getByTestId("add-view").click();
    await page.getByTestId(`add-view-${type}`).click();
    await expect(page.getByTestId(testId)).toBeVisible();
    await expect(page.getByTestId(card)).toHaveCount(3);
  }
  await expect(page.getByTestId("timeline-bar")).toHaveCount(2); // Gamma no tiene fecha
  await expect(page.getByTestId("view-tab")).toHaveCount(4);
  const q = await apiQuery(request, db.cid);
  expect(q.bundle.views.map((v) => v.type)).toEqual(["table", "gallery", "list", "timeline"]);
});

test("vistas: renombrar, duplicar, cambiar diseño y eliminar", async ({ page, request }) => {
  const db = await seedTasks(request);
  await gotoReady(page, `/${db.pageId}`);
  await page.getByTestId("view-tab").click(); // la pestaña activa abre su menú
  await page.getByRole("textbox", { name: "Nombre de la vista" }).fill("Mis tareas");
  await page.getByTestId("duplicate-view").click();
  await expect(page.getByTestId("view-tab")).toHaveCount(2);
  await expect(page.getByTestId("view-tab").nth(1)).toHaveText("Mis tareas (copia)");
  await page.getByTestId("settings-btn").click();
  await page.getByTestId("layout-board").click();
  await expect(page.getByTestId("board-view")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByTestId("view-tab").nth(1).click();
  await page.getByTestId("delete-view").click();
  await expect(page.getByTestId("view-tab")).toHaveCount(1);
  await page.reload();
  await page.locator("html[data-nodara-ready]").waitFor({ state: "attached" });
  await expect(page.getByTestId("view-tab")).toHaveText("Mis tareas");
});

test("propiedades calculadas: fórmula, relación y rollup", async ({ page, request }) => {
  const projects = await apiDatabase(request, "Proyectos");
  const budget = await apiProp(request, projects.cid, { name: "Presupuesto", type: "number" });
  const p1 = await apiRow(request, projects.cid, { title: "Alfa", properties: { [budget.id]: 100 } });
  const p2 = await apiRow(request, projects.cid, { title: "Beta", properties: { [budget.id]: 50 } });
  const tasks = await apiDatabase(request, "Trabajo");
  const hours = await apiProp(request, tasks.cid, { name: "Horas", type: "number" });
  await apiProp(request, tasks.cid, { name: "Costo", type: "formula", config: { expression: 'prop("Horas") * 12.5' } });
  const rel = await apiProp(request, tasks.cid, { name: "Proyecto", type: "relation", config: { relationCollectionId: projects.cid }, bidirectional: true });
  await apiProp(request, tasks.cid, { name: "Total", type: "rollup", config: { rollupRelationId: rel.id, rollupTargetId: budget.id, rollupFn: "sum" } });
  await apiRow(request, tasks.cid, { title: "T1", properties: { [hours.id]: 4, [rel.id]: [p1.id, p2.id] } });
  await gotoReady(page, `/${tasks.pageId}`);
  const row = rowByTitle(page, "T1");
  await expect(row.locator('[data-prop="Costo"]')).toHaveText("50");
  await expect(row.locator('[data-prop="Total"]')).toHaveText("150");
  await expect(row.locator('[data-prop="Proyecto"]').getByTestId("relation-chip")).toHaveCount(2);

  // quitar una relación desde la interfaz recalcula el rollup y la relación recíproca
  await row.locator('[data-prop="Proyecto"]').click({ position: { x: 172, y: 14 } }); // zona libre de la celda, fuera de los enlaces
  await page.getByTestId("relation-item").filter({ hasText: "Beta" }).click();
  await page.keyboard.press("Escape");
  await expect(row.locator('[data-prop="Total"]')).toHaveText("100");
  const back = await apiQuery(request, projects.cid);
  const recip = back.bundle.properties.find((p) => p.name === "Trabajo")!;
  expect(back.rows.find((r) => r.id === p2.id)!.values[recip.id]).toEqual([]);
});

test("fórmula inválida muestra el error y no crea la propiedad", async ({ page, request }) => {
  const db = await seedTasks(request);
  await gotoReady(page, `/${db.pageId}`);
  await page.getByTestId("add-prop").click();
  await page.getByTestId("type-formula").click();
  await page.getByRole("textbox", { name: "Fórmula" }).fill('prop("Inexistente") + 1');
  await page.getByRole("button", { name: "Crear propiedad" }).click();
  await expect(page.getByTestId("add-property").getByRole("alert")).toContainText("Propiedad desconocida");
  await page.getByRole("textbox", { name: "Fórmula" }).fill('prop("Horas") * 2');
  await page.getByRole("button", { name: "Crear propiedad" }).click();
  await expect(page.getByTestId("col-header").filter({ hasText: "Fórmula" })).toBeVisible();
  await expect(rowByTitle(page, "Alfa").locator('[data-prop="Fórmula"]')).toHaveText("6");
});

test("un registro se abre como página con propiedades y contenido editables", async ({ page, request }) => {
  const db = await seedTasks(request);
  await gotoReady(page, `/${db.pageId}`);
  await rowByTitle(page, "Alfa").hover();
  await rowByTitle(page, "Alfa").getByTestId("open-row").click();
  await expect(page).toHaveURL(new RegExp(db.a.id));
  await expect(page.getByTestId("page-title")).toHaveValue("Alfa");
  await expect(page.getByTestId("record-properties")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Ruta" })).toContainText("Tareas");
  await page.locator('[data-testid="record-prop"][data-prop="Horas"]').getByTestId("cell").click();
  await page.keyboard.press("Control+a");
  await page.keyboard.type("42");
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-testid="record-prop"][data-prop="Horas"]')).toContainText("42");
  await page.getByTestId("editor").click();
  await page.keyboard.type("Notas del registro");
  await expect(page.getByTestId("save-status")).toHaveText("Guardado");
  await page.reload();
  await page.locator("html[data-nodara-ready]").waitFor({ state: "attached" });
  await expect(page.getByTestId("editor")).toContainText("Notas del registro");
  const q = await apiQuery(request, db.cid);
  expect(q.rows.find((r) => r.id === db.a.id)!.values[db.hours.id]).toBe(42);
});

test("base de datos integrada en una página mediante /", async ({ page }) => {
  await gotoReady(page, "/");
  await page.getByRole("button", { name: "Nueva página" }).first().click();
  await page.getByTestId("page-title").fill("Con base integrada");
  await page.getByTestId("page-title").press("Enter");
  await expect(page.getByTestId("editor")).toBeFocused();
  await page.keyboard.type("/base");
  await page.getByRole("option", { name: /Base de datos integrada/ }).click();
  const block = page.getByTestId("database-block");
  await expect(block.getByTestId("database")).toBeVisible();
  await block.getByTestId("inline-db-title").fill("Pendientes");
  await block.getByTestId("inline-db-title").blur();
  await block.getByTestId("add-row").click();
  await expect(block.getByRole("textbox", { name: "Título", exact: true })).toBeFocused();
  await page.keyboard.type("Fila integrada");
  await page.keyboard.press("Enter");
  await expect(block.getByTestId("row-title")).toHaveText("Fila integrada");
  await expect(page.getByTestId("save-status")).toHaveText("Guardado");
  await page.reload();
  await page.locator("html[data-nodara-ready]").waitFor({ state: "attached" });
  await expect(page.getByTestId("database-block").getByTestId("row-title")).toHaveText("Fila integrada");
  await expect(page.getByTestId("database-block").getByTestId("inline-db-title")).toHaveValue("Pendientes");
});

test("plantillas: guardar una fila como plantilla y crear filas desde ella", async ({ page, request }) => {
  const db = await seedTasks(request);
  await gotoReady(page, `/${db.pageId}`);
  await rowByTitle(page, "Beta").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Guardar como plantilla" }).click();
  await page.getByTestId("templates-btn").click();
  await expect(page.getByTestId("template-item")).toHaveText("Beta");
  await page.getByTestId("template-item").click();
  await expect(dbRows(page)).toHaveCount(4);
  const q = await apiQuery(request, db.cid);
  const copies = q.rows.filter((r) => r.title === "Beta");
  expect(copies).toHaveLength(2);
  expect(copies[1].values[db.hours.id]).toBe(5);
  expect(copies[1].values[db.status.id]).toBe("doing");
  // eliminar la plantilla
  await page.getByTestId("templates-btn").click();
  await page.getByRole("button", { name: "Eliminar plantilla Beta" }).click({ force: true });
  await expect(page.getByTestId("template-item")).toHaveCount(0);
});

test("archivos: subir, mostrar enlace y quitar", async ({ page, request }) => {
  const db = await apiDatabase(request);
  await apiProp(request, db.cid, { name: "Adjuntos", type: "files" });
  await apiRow(request, db.cid, { title: "Con archivo" });
  await gotoReady(page, `/${db.pageId}`);
  await rowByTitle(page, "Con archivo").getByTestId("cell").click();
  await page.getByTestId("file-input").setInputFiles({ name: "nota.txt", mimeType: "text/plain", buffer: Buffer.from("hola archivo") });
  const link = rowByTitle(page, "Con archivo").getByRole("link", { name: "nota.txt" });
  await expect(link).toBeVisible();
  const href = (await link.getAttribute("href"))!;
  const file = await request.get(href);
  expect(file.status()).toBe(200);
  expect(await file.text()).toBe("hola archivo");
  expect(file.headers()["x-content-type-options"]).toBe("nosniff");
  await page.reload();
  await page.locator("html[data-nodara-ready]").waitFor({ state: "attached" });
  await expect(rowByTitle(page, "Con archivo").getByRole("link", { name: "nota.txt" })).toBeVisible();
  expect((await request.get("/api/files/00000000-0000-4000-8000-000000000000")).status()).toBe(404);
  expect((await request.get("/api/files/..%2f..%2fetc")).status()).toBe(404);
});

test("buscar dentro de la base, duplicar y eliminar filas", async ({ page, request }) => {
  const db = await seedTasks(request);
  await gotoReady(page, `/${db.pageId}`);
  await page.getByTestId("search-btn").click();
  await page.getByTestId("db-search").fill("gam");
  await expect(dbRows(page)).toHaveCount(1);
  await page.getByTestId("db-search").fill("");
  await page.keyboard.press("Escape");
  await expect(dbRows(page)).toHaveCount(3);

  await rowByTitle(page, "Alfa").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Duplicar" }).click();
  await expect(dbRows(page)).toHaveCount(4);
  await rowByTitle(page, "Gamma").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Mover a la papelera" }).click();
  await expect(dbRows(page)).toHaveCount(3);
  expect((await apiQuery(request, db.cid)).rows.map((r) => r.title).sort()).toEqual(["Alfa", "Alfa", "Beta"]);
  // los registros no aparecen en el árbol de páginas
  await expect(page.getByTestId("sidebar-page")).toHaveCount(1);
});

test("duplicar la página que aloja una base copia sus datos sin compartirlos", async ({ page, request }) => {
  const db = await seedTasks(request);
  await gotoReady(page, `/${db.pageId}`);
  await page.getByTestId("sidebar-page").filter({ hasText: "Tareas" }).click({ button: "right" });
  await page.getByRole("menuitem", { name: /Duplicar/ }).click();
  await expect(page).not.toHaveURL(new RegExp(db.pageId));
  await expect(dbRows(page)).toHaveCount(3);
  await rowByTitle(page, "Alfa").getByTestId("row-title").click();
  await page.keyboard.press("Control+a");
  await page.keyboard.type("Alfa copia");
  await page.keyboard.press("Enter");
  await expect(rowByTitle(page, "Alfa copia")).toBeVisible();
  expect((await apiQuery(request, db.cid)).rows.map((r) => r.title).sort()).toEqual(["Alfa", "Beta", "Gamma"]); // el original intacto
});

test("tema oscuro: la tabla usa los colores del tema", async ({ page, request }) => {
  const db = await seedTasks(request);
  await gotoReady(page, `/${db.pageId}`);
  const header = page.getByTestId("col-header").first();
  await expect(header).toHaveCSS("color", "rgb(114, 111, 106)");
  await page.getByTestId("theme-toggle").click();
  await expect(header).toHaveCSS("color", "rgb(173, 169, 163)");
  await expect(page.getByTestId("db-row").first().getByTestId("row-title")).toHaveCSS("color", "rgb(240, 239, 237)");
});

test("API: valida propiedades, filtros y valores", async ({ request }) => {
  const db = await apiDatabase(request);
  const num = await apiProp(request, db.cid, { name: "N", type: "number" });
  const r = await apiRow(request, db.cid, { title: "x" });
  expect((await request.post(`/api/databases/${db.cid}/properties`, { data: { name: "N", type: "text" } })).status()).toBe(400); // nombre repetido
  expect((await request.post(`/api/databases/${db.cid}/properties`, { data: { name: "Z", type: "inventado" } })).status()).toBe(400);
  expect((await request.patch(`/api/records/${r.id}`, { data: { properties: { [num.id]: "no" } } })).status()).toBe(400);
  expect((await request.patch(`/api/records/${r.id}`, { data: { properties: { zzz: 1 } } })).status()).toBe(400);
  expect((await request.post(`/api/databases/${db.cid}/query`, { data: { config: { filter: { op: "xor", conditions: [] } } } })).status()).toBe(400);
  expect((await request.post(`/api/databases/00000000-0000-4000-8000-000000000000/query`, { data: {} })).status()).toBe(404);
  expect((await request.delete(`/api/views/${db.viewId}`)).status()).toBe(400); // última vista
});
