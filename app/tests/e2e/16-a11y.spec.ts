import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { apiCreate, apiDatabase, apiProp, apiRow, expect, gotoReady, test } from "./fixtures";

/** Violaciones graves o críticas de axe-core (WCAG 2.1 A/AA), resumidas para que el fallo sea legible. */
async function violations(page: Page, scope?: string) {
  let b = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
  if (scope) b = b.include(scope);
  const res = await b.analyze();
  return res.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`accesibilidad (axe) — tema ${theme}`, () => {
    test.beforeEach(async ({ page }) => {
      // Sin animaciones: axe debe medir el estado final, no un diálogo a mitad de su aparición (opacidad < 1).
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.addInitScript((t) => localStorage.setItem("nodara:theme", t), theme);
    });

    test("portada comercial y aviso del modo sin cuenta", async ({ page, browser }) => {
      await page.goto("/bienvenida");
      await page.getByTestId("landing").waitFor();
      expect(await violations(page)).toEqual([]);
      const ctx = await browser.newContext({ baseURL: "http://127.0.0.1:3100", colorScheme: theme, reducedMotion: "reduce", extraHTTPHeaders: { "x-nodara-e2e-token": process.env.NODARA_E2E_TOKEN ?? "" } });
      await ctx.addInitScript((t) => localStorage.setItem("nodara:theme", t), theme);
      const guest = await ctx.newPage();
      await guest.goto("/bienvenida");
      await guest.getByTestId("landing-try").click();
      await guest.getByTestId("account-dialog").waitFor();
      expect(await violations(guest)).toEqual([]);
      await ctx.close();
    });

    test("inicio y barra lateral", async ({ page }) => {
      await gotoReady(page, "/");
      expect(await violations(page)).toEqual([]);
    });

    test("página con editor y bloques avanzados", async ({ page, request }) => {
      const doc = await apiCreate(request, { title: "Accesible" });
      await request.patch(`/api/pages/${doc.id}`, {
        data: {
          content: {
            type: "doc",
            content: [
              { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Sección" }] },
              { type: "paragraph", content: [{ type: "text", text: "Texto normal con " }, { type: "text", text: "enlace", marks: [{ type: "link", attrs: { href: "https://ejemplo.com" } }] }] },
              { type: "callout", attrs: { icon: "💡", color: "gray" }, content: [{ type: "paragraph", content: [{ type: "text", text: "Aviso" }] }] },
              { type: "mathBlock", attrs: { latex: "x^2" } },
              { type: "taskList", content: [{ type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Tarea" }] }] }] },
              { type: "codeBlock", attrs: { language: "javascript" }, content: [{ type: "text", text: "const a = 1;" }] },
            ],
          },
        },
      });
      await gotoReady(page, `/${doc.id}`);
      await expect(page.getByTestId("callout")).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test("base de datos en tabla", async ({ page, request }) => {
      const db = await apiDatabase(request, "Tabla accesible");
      await apiProp(request, db.cid, { name: "Horas", type: "number" });
      await apiRow(request, db.cid, { title: "Fila uno" });
      await gotoReady(page, `/${db.pageId}`);
      await expect(page.getByTestId("db-row")).toHaveCount(1);
      expect(await violations(page)).toEqual([]);
    });

    test("diálogos: búsqueda, plantillas, atajos y configuración", async ({ page }) => {
      await gotoReady(page, "/");
      await page.keyboard.press("Control+k");
      await expect(page.getByTestId("search-dialog")).toBeVisible();
      expect(await violations(page)).toEqual([]);
      await page.keyboard.press("Escape");
      await page.getByTestId("open-templates").click();
      await expect(page.getByTestId("templates-dialog")).toBeVisible();
      expect(await violations(page)).toEqual([]);
      await page.keyboard.press("Escape");
      await page.keyboard.press("Control+/");
      await expect(page.getByTestId("shortcuts-dialog")).toBeVisible();
      expect(await violations(page)).toEqual([]);
      await page.keyboard.press("Escape");
      await page.getByTestId("workspace-switcher").click();
      await page.getByTestId("open-settings").click();
      await expect(page.getByTestId("settings-dialog")).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });
  });
}

test("páginas públicas de acceso (login y registro)", async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: "http://127.0.0.1:3100", extraHTTPHeaders: { "x-nodara-e2e-token": process.env.NODARA_E2E_TOKEN ?? "" } });
  const page = await ctx.newPage();
  for (const path of ["/login", "/signup"]) {
    await page.goto(path);
    await page.getByRole("heading").first().waitFor();
    expect(await violations(page), path).toEqual([]);
  }
  await ctx.close();
});
