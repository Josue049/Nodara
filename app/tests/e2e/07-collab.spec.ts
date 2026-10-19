import { apiCreate, expect, gotoReady, newUser, test } from "./fixtures";
import type { APIRequestContext } from "@playwright/test";

/** Crea una página del propietario compartida con `email` al nivel indicado. */
async function sharedPage(request: APIRequestContext, email: string, level: "view" | "comment" | "edit" | "full", title = "Documento compartido") {
  const doc = await apiCreate(request, { title });
  const res = await request.post(`/api/pages/${doc.id}/share`, { data: { email, level } });
  expect(res.status()).toBe(201);
  return doc;
}

/** Texto del editor sin las etiquetas de cursor remoto (que se insertan dentro del contenido). */
const editorText = (page: import("@playwright/test").Page) =>
  page.getByTestId("editor").evaluate((el) => {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(".nd-caret").forEach((n) => n.remove());
    return clone.textContent ?? "";
  });

test.describe("edición colaborativa", () => {
  test("dos personas ven los cambios del otro en tiempo real", async ({ page, browser, request }) => {
    const ana = await newUser(browser, "ana@nodara.test", "Ana");
    const doc = await sharedPage(request, "ana@nodara.test", "edit");
    await gotoReady(page, `/${doc.id}`);
    await gotoReady(ana.page, `/${doc.id}`);
    await page.getByTestId("editor").click();
    await page.keyboard.type("Hola desde el autor");
    await expect.poll(() => editorText(ana.page)).toContain("Hola desde el autor");
    await ana.page.getByTestId("editor").click();
    await ana.page.keyboard.press("Control+End");
    await ana.page.keyboard.type(" y Ana responde");
    await expect.poll(() => editorText(page)).toContain("Hola desde el autor y Ana responde");
    await ana.context.close();
  });

  test("la edición simultánea converge sin perder ningún cambio", async ({ page, browser, request }) => {
    const ana = await newUser(browser, "ana@nodara.test", "Ana");
    const doc = await sharedPage(request, "ana@nodara.test", "edit");
    await request.patch(`/api/pages/${doc.id}`, { data: { content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Base" }] }, { type: "paragraph", content: [{ type: "text", text: "Fin" }] }] } } });
    await gotoReady(page, `/${doc.id}`);
    await gotoReady(ana.page, `/${doc.id}`);
    await expect(page.getByTestId("editor")).toContainText("Base");
    await expect(ana.page.getByTestId("editor")).toContainText("Fin");
    await page.getByTestId("editor").locator("p").first().click();
    await page.keyboard.press("End");
    await ana.page.getByTestId("editor").locator("p").nth(1).click();
    await ana.page.keyboard.press("End");
    // ambos escriben a la vez
    await Promise.all([page.keyboard.type("-AUTOR-1234567890", { delay: 15 }), ana.page.keyboard.type("-ANA-0987654321", { delay: 15 })]);
    // Ningún texto se pierde ni se mezcla: ambos fragmentos completos están en las dos pantallas y en el servidor.
    for (const p of [page, ana.page]) {
      await expect.poll(() => editorText(p)).toContain("-AUTOR-1234567890");
      await expect.poll(() => editorText(p)).toContain("ANA-0987654321");
      await expect.poll(() => editorText(p)).toContain("Base");
      await expect.poll(() => editorText(p)).toContain("Fin");
    }
    await expect.poll(async () => (await editorText(page)) === (await editorText(ana.page))).toBe(true);
    const savedText = async () => (await (await request.get(`/api/pages/${doc.id}`)).json()).contentText as string;
    await expect.poll(savedText).toContain("-AUTOR-1234567890");
    await expect.poll(savedText).toContain("ANA-0987654321");
    await ana.context.close();
  });

  test("presencia: avatares de quien está en la página y su cursor con nombre", async ({ page, browser, request }) => {
    const ana = await newUser(browser, "ana@nodara.test", "Ana");
    const doc = await sharedPage(request, "ana@nodara.test", "edit");
    await request.patch(`/api/pages/${doc.id}`, { data: { content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Texto para el cursor" }] }] } } });
    await gotoReady(page, `/${doc.id}`);
    await expect(page.getByTestId("presence-avatar")).toHaveCount(0);
    await gotoReady(ana.page, `/${doc.id}`);
    await expect(page.getByTestId("presence-avatar")).toHaveCount(1);
    await expect(page.getByTestId("presence-avatar")).toHaveAttribute("title", "Ana");
    await expect(ana.page.getByTestId("presence-avatar")).toHaveAttribute("title", "Tester");
    await ana.page.getByTestId("editor").click();
    await expect(page.getByTestId("remote-caret")).toBeVisible();
    await expect(page.getByTestId("remote-caret")).toContainText("Ana");
    await ana.context.close(); // al cerrar la pestaña, su presencia desaparece
    await expect(page.getByTestId("presence-avatar")).toHaveCount(0);
  });

  test("sin conexión: los cambios locales se conservan y se sincronizan al volver", async ({ page, browser, request }) => {
    const ana = await newUser(browser, "ana@nodara.test", "Ana");
    const doc = await sharedPage(request, "ana@nodara.test", "edit");
    await gotoReady(page, `/${doc.id}`);
    await gotoReady(ana.page, `/${doc.id}`);
    await page.getByTestId("editor").click();
    await page.keyboard.type("Antes de cortar. ");
    await expect(ana.page.getByTestId("editor")).toContainText("Antes de cortar.");

    await ana.context.setOffline(true);
    await expect(ana.page.getByTestId("offline-badge")).toBeVisible();
    await ana.page.getByTestId("editor").click();
    await ana.page.keyboard.press("Control+End");
    await ana.page.keyboard.type("Texto escrito sin red.");
    await page.keyboard.type("Mientras Ana no está. "); // el autor sigue editando

    await ana.context.setOffline(false);
    await expect(ana.page.getByTestId("offline-badge")).toBeHidden({ timeout: 15_000 });
    for (const p of [page, ana.page]) {
      await expect.poll(() => editorText(p), { timeout: 15_000 }).toContain("Texto escrito sin red.");
      await expect.poll(() => editorText(p)).toContain("Mientras Ana no está.");
    }
    await expect.poll(async () => (await editorText(page)) === (await editorText(ana.page))).toBe(true);
    await ana.context.close();
  });

  test("el título cambiado por otra persona se actualiza en vivo", async ({ page, browser, request }) => {
    const ana = await newUser(browser, "ana@nodara.test", "Ana");
    const doc = await sharedPage(request, "ana@nodara.test", "edit", "Título original");
    await gotoReady(page, `/${doc.id}`);
    await gotoReady(ana.page, `/${doc.id}`);
    await ana.page.getByTestId("page-title").fill("Título de Ana");
    await expect(page.getByTestId("page-title")).toHaveValue("Título de Ana");
  });

  test("quien solo puede ver recibe los cambios, pero el servidor rechaza sus ediciones", async ({ page, browser, request }) => {
    const ana = await newUser(browser, "ana@nodara.test", "Ana");
    const doc = await sharedPage(request, "ana@nodara.test", "view");
    await gotoReady(page, `/${doc.id}`);
    await gotoReady(ana.page, `/${doc.id}`);
    await expect(ana.page.getByTestId("readonly-badge")).toBeVisible();
    await page.getByTestId("editor").click();
    await page.keyboard.type("Solo lectura para Ana");
    await expect(ana.page.getByTestId("editor")).toContainText("Solo lectura para Ana");
    const forged = await ana.request.post(`/api/collab/${doc.id}/update`, { data: { cid: "cliente-manipulado", update: "AAA=" } });
    expect(forged.status()).toBe(403);
    expect((await ana.request.get(`/api/collab/${doc.id}/stream?cid=12345678&aid=1`, { timeout: 2000 }).catch(() => ({ status: () => 200 }))).status()).toBe(200);
    await ana.context.close();
  });

  test("restaurar una versión recarga a quienes tienen la página abierta", async ({ page, browser, request }) => {
    const ana = await newUser(browser, "ana@nodara.test", "Ana");
    const doc = await sharedPage(request, "ana@nodara.test", "edit");
    await gotoReady(page, `/${doc.id}`);
    await page.getByTestId("editor").click();
    await page.keyboard.type("Versión uno");
    const count = async () => (await (await request.get(`/api/pages/${doc.id}/versions`)).json()).length;
    await expect.poll(count).toBe(1);
    await page.keyboard.type(" más cambios");
    await expect.poll(count).toBe(2);
    await gotoReady(ana.page, `/${doc.id}`);
    await expect(ana.page.getByTestId("editor")).toContainText("Versión uno más cambios");
    const versions = await (await request.get(`/api/pages/${doc.id}/versions`)).json();
    const oldest = versions[versions.length - 1];
    expect((await request.post(`/api/pages/${doc.id}/versions/${oldest.id}/restore`)).status()).toBe(204);
    await ana.page.locator("html[data-nodara-ready]").waitFor({ state: "attached" });
    await expect(ana.page.getByTestId("editor")).toContainText("Versión uno");
    await expect(ana.page.getByTestId("editor")).not.toContainText("más cambios");
    await ana.context.close();
  });

  test("el contenido colaborativo se guarda en el servidor y sobrevive a recargas", async ({ page, request }) => {
    const doc = await apiCreate(request, { title: "Persistente" });
    await gotoReady(page, `/${doc.id}`);
    await page.getByTestId("editor").click();
    await page.keyboard.type("Contenido que debe persistir");
    await expect.poll(async () => (await (await request.get(`/api/pages/${doc.id}`)).json()).contentText).toBe("Contenido que debe persistir");
    const found = await (await request.get(`/api/search?q=persistir`)).json();
    expect(found.map((r: { id: string }) => r.id)).toContain(doc.id);
    await page.reload();
    await page.locator("html[data-nodara-ready]").waitFor({ state: "attached" });
    await expect(page.getByTestId("editor")).toContainText("Contenido que debe persistir");
  });
});
