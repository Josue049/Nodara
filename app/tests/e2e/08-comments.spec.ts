import { apiCreate, expect, gotoReady, newUser, test } from "./fixtures";

async function sharedPage(request: import("@playwright/test").APIRequestContext, email: string, level: "view" | "comment" | "edit" | "full", title = "Con comentarios") {
  const doc = await apiCreate(request, { title });
  expect((await request.post(`/api/pages/${doc.id}/share`, { data: { email, level } })).status()).toBe(201);
  return doc;
}

test.describe("comentarios y notificaciones", () => {
  test("comentar un texto seleccionado crea un hilo anclado y resaltado", async ({ page, request }) => {
    const doc = await apiCreate(request, { title: "Hilo anclado" });
    await gotoReady(page, `/${doc.id}`);
    await page.getByTestId("editor").click();
    await page.keyboard.type("Texto a comentar");
    await page.keyboard.press("Control+A");
    await page.getByTestId("comment-btn").click();
    await expect(page.getByTestId("comments-panel")).toBeVisible();
    await expect(page.getByTestId("draft-thread")).toContainText("Texto a comentar");
    await page.getByLabel("Comentario sobre la selección").fill("Revisar esta frase");
    await page.getByTestId("draft-thread").getByRole("button", { name: "Comentar", exact: true }).click();
    await expect(page.getByTestId("thread")).toHaveCount(1);
    await expect(page.getByTestId("thread")).toContainText("Revisar esta frase");
    await expect(page.getByTestId("editor").locator(".nd-comment")).toContainText("Texto a comentar");
    const threads = await (await request.get(`/api/pages/${doc.id}/comments`)).json();
    expect(threads).toHaveLength(1);
    expect(threads[0].anchorText).toBe("Texto a comentar");
  });

  test("responder, resolver y reabrir un hilo", async ({ page, request }) => {
    const doc = await apiCreate(request, { title: "Resolver" });
    await request.post(`/api/pages/${doc.id}/comments`, { data: { body: "Primer comentario" } });
    await gotoReady(page, `/${doc.id}`);
    await page.getByTestId("comments-btn").click();
    await expect(page.getByTestId("thread")).toContainText("Primer comentario");
    await page.getByLabel("Responder").fill("Una respuesta");
    await page.getByTestId("thread").getByRole("button", { name: "Comentar", exact: true }).click();
    await expect(page.getByTestId("comment")).toHaveCount(2);
    await page.getByTestId("resolve-thread").click();
    await expect(page.getByTestId("no-threads")).toBeVisible();
    await page.getByTestId("tab-resolved").click();
    await expect(page.getByTestId("thread")).toHaveCount(1);
    await page.getByTestId("reopen-thread").click();
    await expect(page.getByTestId("no-threads")).toBeVisible();
    await page.getByTestId("tab-open").click();
    await expect(page.getByTestId("thread")).toHaveCount(1);
  });

  test("una mención llega a la bandeja de la otra persona y se marca como leída", async ({ browser, request }) => {
    const ana = await newUser(browser, "ana@nodara.test", "Ana");
    const doc = await sharedPage(request, "ana@nodara.test", "comment");
    await gotoReady(ana.page, "/");
    await expect(ana.page.getByTestId("inbox-badge")).toHaveCount(0);
    const res = await request.post(`/api/pages/${doc.id}/comments`, { data: { body: "@Ana mira esto", mentions: [ana.user.id] } });
    expect(res.status()).toBe(201);
    await expect.poll(async () => (await (await ana.request.get("/api/notifications")).json()).unread).toBe(1);
    await ana.page.reload();
    await ana.page.locator("html[data-nodara-ready]").waitFor({ state: "attached" });
    await expect(ana.page.getByTestId("inbox-badge")).toHaveText("1");
    await ana.page.getByTestId("inbox-btn").click();
    await expect(ana.page.getByTestId("inbox-item")).toHaveCount(1);
    await expect(ana.page.getByTestId("inbox-item")).toContainText("te mencionó");
    await ana.page.getByTestId("inbox-item").click();
    await expect(ana.page).toHaveURL(new RegExp(`/${doc.id}$`));
    await expect.poll(async () => (await (await ana.request.get("/api/notifications")).json()).unread).toBe(0);
    await ana.context.close();
  });

  test("quien solo puede ver no puede comentar", async ({ browser, request }) => {
    const ana = await newUser(browser, "ana@nodara.test", "Ana");
    const doc = await sharedPage(request, "ana@nodara.test", "view");
    const res = await ana.request.post(`/api/pages/${doc.id}/comments`, { data: { body: "No debería" } });
    expect(res.status()).toBe(403);
    await ana.context.close();
  });

  test("las respuestas notifican a quien participa en el hilo", async ({ browser, request }) => {
    const ana = await newUser(browser, "ana@nodara.test", "Ana");
    const doc = await sharedPage(request, "ana@nodara.test", "comment");
    const { id } = await (await ana.request.post(`/api/pages/${doc.id}/comments`, { data: { body: "Pregunta de Ana" } })).json();
    await expect.poll(async () => (await (await request.get("/api/notifications")).json()).unread).toBe(1); // el autor de la página
    await request.post(`/api/comments/${id}`, { data: { body: "Respuesta del autor" } });
    await expect.poll(async () => (await (await ana.request.get("/api/notifications")).json()).items.map((n: { type: string }) => n.type)).toContain("reply");
    await ana.context.close();
  });
});
