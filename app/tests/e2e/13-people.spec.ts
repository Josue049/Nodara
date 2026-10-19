import { apiDatabase, apiProp, apiQuery, apiRow, dbRows, expect, gotoReady, newUser, rowByTitle, test } from "./fixtures";
import type { APIRequestContext } from "@playwright/test";

async function joinWorkspace(owner: APIRequestContext, member: APIRequestContext, email: string) {
  const wsId = (await (await owner.get("/api/me")).json()).currentWorkspaceId as string;
  const inv = await (await owner.post(`/api/workspaces/${wsId}/invitations`, { data: { email, role: "member" } })).json();
  expect((await member.post(`/api/invitations/${inv.token}/accept`)).status()).toBe(200);
}

test.describe("propiedades Persona y Creado por", () => {
  test("elegir personas en una celda, ver sus chips y persistir", async ({ page, browser, request }) => {
    const ana = await newUser(browser, "ana@nodara.test", "Ana Pérez");
    await joinWorkspace(request, ana.request, "ana@nodara.test");
    const db = await apiDatabase(request, "Tareas con responsables");
    const who = await apiProp(request, db.cid, { name: "Responsable", type: "person" });
    await apiRow(request, db.cid, { title: "Diseñar portada" });
    await apiRow(request, db.cid, { title: "Escribir guía" });
    await gotoReady(page, `/${db.pageId}`);
    await rowByTitle(page, "Diseñar portada").getByTestId("cell").and(page.locator('[data-prop="Responsable"]')).click();
    await expect(page.getByTestId("person-picker")).toBeVisible();
    await expect(page.getByTestId("person-item")).toHaveCount(2); // Tester y Ana
    await page.getByTestId("person-item").filter({ hasText: "Ana Pérez" }).click();
    await page.keyboard.press("Escape");
    const chip = rowByTitle(page, "Diseñar portada").getByTestId("person-chip");
    await expect(chip).toContainText("Ana Pérez");
    await expect.poll(async () => (await apiQuery(request, db.cid)).rows.find((r) => r.title === "Diseñar portada")!.values[who.id]).toEqual([expect.any(String)]);
    await page.reload();
    await page.locator("html[data-nodara-ready]").waitFor({ state: "attached" });
    await expect(rowByTitle(page, "Diseñar portada").getByTestId("person-chip")).toContainText("Ana Pérez");
    await ana.context.close();
  });

  test("filtrar por persona deja solo sus filas", async ({ page, browser, request }) => {
    const ana = await newUser(browser, "ana@nodara.test", "Ana Pérez");
    await joinWorkspace(request, ana.request, "ana@nodara.test");
    const me = (await (await request.get("/api/me")).json()).user.id as string;
    const anaId = (await (await ana.request.get("/api/me")).json()).user.id as string;
    const db = await apiDatabase(request, "Filtro por persona");
    const who = await apiProp(request, db.cid, { name: "Responsable", type: "person" });
    await apiRow(request, db.cid, { title: "Una", properties: { [who.id]: [anaId] } });
    await apiRow(request, db.cid, { title: "Dos", properties: { [who.id]: [me] } });
    await apiRow(request, db.cid, { title: "Tres", properties: { [who.id]: [me, anaId] } });
    await apiRow(request, db.cid, { title: "Cuatro" });
    await gotoReady(page, `/${db.pageId}`);
    await expect(dbRows(page)).toHaveCount(4);
    await page.getByTestId("filter-btn").click();
    await page.getByTestId("add-filter").click();
    await page.getByRole("combobox", { name: "Propiedad del filtro" }).selectOption({ label: "Responsable" });
    await page.getByRole("combobox", { name: "Valor del filtro" }).selectOption({ label: "Ana Pérez" });
    await expect(dbRows(page)).toHaveCount(2);
    await expect(rowByTitle(page, "Una")).toBeVisible();
    await expect(rowByTitle(page, "Tres")).toBeVisible();
    await page.getByRole("combobox", { name: "Operador" }).selectOption({ label: "está vacío" });
    await expect(dbRows(page)).toHaveCount(1);
    await expect(rowByTitle(page, "Cuatro")).toBeVisible();
    await ana.context.close();
  });

  test("«Creado por» se calcula solo y no es editable", async ({ page, browser, request }) => {
    const ana = await newUser(browser, "ana@nodara.test", "Ana Pérez");
    await joinWorkspace(request, ana.request, "ana@nodara.test");
    const db = await apiDatabase(request, "Autoría");
    const by = await apiProp(request, db.cid, { name: "Autor", type: "created_by" });
    expect((await request.post(`/api/pages/${db.pageId}/share`, { data: { email: "ana@nodara.test", level: "edit" } })).status()).toBe(201);
    await apiRow(request, db.cid, { title: "Del propietario" });
    await apiRow(ana.request, db.cid, { title: "De Ana" });
    const rows = (await apiQuery(request, db.cid)).rows;
    expect(rows.find((r) => r.title === "De Ana")!.values[by.id]).toEqual([expect.any(String)]);
    await gotoReady(page, `/${db.pageId}`);
    await expect(rowByTitle(page, "De Ana").getByTestId("person-chip")).toContainText("Ana Pérez");
    await expect(rowByTitle(page, "Del propietario").getByTestId("person-chip")).toContainText("Tester");
    await rowByTitle(page, "De Ana").locator('[data-prop="Autor"]').click();
    await expect(page.getByTestId("person-picker")).toHaveCount(0); // calculada: no se edita
    // el servidor tampoco deja escribirla
    const bad = await request.post(`/api/databases/${db.cid}/records`, { data: { title: "x", properties: { [by.id]: ["00000000-0000-4000-8000-000000000000"] } } });
    expect(bad.status()).toBe(400);
    await ana.context.close();
  });

  test("valores inválidos se rechazan y las exportaciones muestran nombres", async ({ request, browser }) => {
    const ana = await newUser(browser, "ana@nodara.test", "Ana Pérez");
    await joinWorkspace(request, ana.request, "ana@nodara.test");
    const anaId = (await (await ana.request.get("/api/me")).json()).user.id as string;
    const db = await apiDatabase(request, "Exportar personas");
    const who = await apiProp(request, db.cid, { name: "Responsable", type: "person" });
    const bad = await request.post(`/api/databases/${db.cid}/records`, { data: { title: "x", properties: { [who.id]: ["no-es-un-uuid"] } } });
    expect(bad.status()).toBe(400);
    await apiRow(request, db.cid, { title: "Con responsable", properties: { [who.id]: [anaId] } });
    const csv = await (await request.get(`/api/databases/${db.cid}/export`)).text();
    expect(csv).toContain("Con responsable,Ana Pérez");
    await ana.context.close();
  });

  test("en un enlace público no se filtra la lista de miembros", async ({ request }) => {
    const db = await apiDatabase(request, "Pública con personas");
    await apiProp(request, db.cid, { name: "Responsable", type: "person" });
    const token = (await (await request.post(`/api/pages/${db.pageId}/publish`, { data: { level: "view" } })).json()).token as string;
    const res = await request.post(`/api/public/${token}/databases/${db.cid}/query`, { data: {} });
    expect(res.status()).toBe(200);
    expect((await res.json()).members).toEqual([]);
  });
});
