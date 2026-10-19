import { expect, gotoReady, test } from "./fixtures";

test.describe("preparación para producción", () => {
  test("/api/health responde sin sesión y sin revelar datos internos", async ({ playwright, baseURL }) => {
    const anon = await playwright.request.newContext({ baseURL });
    const res = await anon.get("/api/health");
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(res.headers()["cache-control"]).toContain("no-store");
    await anon.dispose();
  });

  test("las respuestas incluyen cabeceras de seguridad", async ({ request }) => {
    const res = await request.get("/api/pages");
    const h = res.headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"]).toContain("camera=()");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["content-security-policy"]).toContain("object-src 'none'");
    expect(h["content-security-policy"]).not.toContain("unsafe-eval");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("la aplicación funciona con la política CSP (sin errores de seguridad en consola)", async ({ page, request }) => {
    const violations: string[] = [];
    page.on("console", (m) => /Content Security Policy|Refused to/i.test(m.text()) && violations.push(m.text()));
    page.on("pageerror", (e) => violations.push(e.message));
    const doc = await request.post("/api/pages", { data: { title: "Con CSP" } }).then((r) => r.json());
    await gotoReady(page, `/${doc.id}`);
    await page.getByTestId("editor").click();
    await page.keyboard.type("Texto con $x^2$ y /");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("math-inline").locator(".katex")).toBeVisible();
    expect(violations).toEqual([]);
  });

  test("una ruta inexistente muestra la página 404 de Nodara", async ({ page }) => {
    const res = await page.goto("/ruta/que/no/existe");
    expect(res?.status()).toBe(404);
    await expect(page.getByTestId("not-found")).toBeVisible();
  });

  test("los identificadores mal formados devuelven 400/404, nunca 500", async ({ request }) => {
    for (const path of ["/api/pages/no-es-uuid", "/api/databases/123/query", "/api/files/../../etc/passwd", "/api/comments/xyz"]) {
      const res = await request.get(path);
      expect([400, 404, 405]).toContain(res.status());
    }
  });

  test("una subida que supera el límite se rechaza con 413", async ({ request }) => {
    const big = Buffer.alloc(21 * 1024 * 1024, 1);
    const res = await request.post("/api/files", { multipart: { file: { name: "enorme.bin", mimeType: "application/octet-stream", buffer: big } } });
    expect([413, 400]).toContain(res.status());
  });
});
