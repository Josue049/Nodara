import { apiDatabase, apiProp, apiQuery, apiRow, expect, gotoReady, rowByTitle, test } from "./fixtures";

test.describe("ventana lateral de registros", () => {
  test("por defecto los registros se abren como página completa", async ({ page, request }) => {
    const db = await apiDatabase(request, "Predeterminada");
    const row = await apiRow(request, db.cid, { title: "Registro A" });
    await gotoReady(page, `/${db.pageId}`);
    await rowByTitle(page, "Registro A").getByTestId("open-row").click({ force: true });
    await expect(page).toHaveURL(new RegExp(row.id));
    await expect(page.getByTestId("record-peek")).toHaveCount(0);
  });

  test("con «Ventana lateral» el registro se abre en un panel editable sin salir de la base", async ({ page, request }) => {
    const db = await apiDatabase(request, "Con peek");
    const horas = await apiProp(request, db.cid, { name: "Horas", type: "number" });
    const row = await apiRow(request, db.cid, { title: "Registro B", properties: { [horas.id]: 3 } });
    await gotoReady(page, `/${db.pageId}`);
    await page.getByTestId("settings-btn").click();
    await page.getByTestId("open-pages-in").selectOption("side");
    await page.keyboard.press("Escape");
    // persistido en la vista
    await expect.poll(async () => (await apiQuery(request, db.cid)).bundle.views[0].config).toMatchObject({ openPagesIn: "side" });

    await rowByTitle(page, "Registro B").getByTestId("open-row").click({ force: true });
    const peek = page.getByTestId("record-peek");
    await expect(peek).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/${db.pageId}$`)); // la URL no cambia
    await expect(peek.getByTestId("page-title")).toHaveValue("Registro B");
    await expect(peek.getByTestId("record-properties")).toContainText("Horas");
    // se edita el contenido del registro dentro del panel
    await peek.getByTestId("editor").click();
    await page.keyboard.type("Notas del registro");
    await expect.poll(async () => (await (await request.get(`/api/pages/${row.id}`)).json()).contentText).toContain("Notas del registro");
    // y su título
    await peek.getByTestId("page-title").fill("Registro B editado");
    await expect.poll(async () => (await apiQuery(request, db.cid)).rows[0].title).toBe("Registro B editado");
    // la tabla de fondo refleja el cambio
    await page.getByTestId("peek-close").click();
    await expect(page.getByTestId("record-peek")).toHaveCount(0);
    await expect(rowByTitle(page, "Registro B editado")).toBeVisible();
  });

  test("Escape cierra el panel y «Abrir como página» navega al registro", async ({ page, request }) => {
    const db = await apiDatabase(request, "Peek escape");
    const row = await apiRow(request, db.cid, { title: "Registro C" });
    await request.patch(`/api/views/${db.viewId}`, { data: { config: { openPagesIn: "side" } } });
    await gotoReady(page, `/${db.pageId}`);
    await rowByTitle(page, "Registro C").getByTestId("open-row").click({ force: true });
    await expect(page.getByTestId("record-peek")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("record-peek")).toHaveCount(0);
    await rowByTitle(page, "Registro C").getByTestId("open-row").click({ force: true });
    await page.getByTestId("peek-expand").click();
    await expect(page).toHaveURL(new RegExp(row.id));
    await expect(page.getByTestId("record-peek")).toHaveCount(0);
  });

  test("Ctrl+clic sigue abriendo la página completa", async ({ page, context, request }) => {
    const db = await apiDatabase(request, "Peek ctrl");
    const row = await apiRow(request, db.cid, { title: "Registro D" });
    await request.patch(`/api/views/${db.viewId}`, { data: { config: { openPagesIn: "side" } } });
    await gotoReady(page, `/${db.pageId}`);
    const popup = context.waitForEvent("page");
    await rowByTitle(page, "Registro D").getByTestId("open-row").click({ force: true, modifiers: ["Control"] });
    const opened = await popup;
    await expect(opened).toHaveURL(new RegExp(row.id));
    await expect(page.getByTestId("record-peek")).toHaveCount(0);
  });
});
