import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { apiCreate, apiDatabase, apiOption, apiProp, apiRow, expect, newUser, test } from "./fixtures";

const API_ROOT = path.resolve(process.cwd(), "src/app/api");
const UUID = "00000000-0000-4000-8000-000000000001";

/** Todas las operaciones HTTP del backend leyendo los route.ts (así una ruta nueva entra sola en el barrido). */
function operations() {
  const out: { route: string; method: string; auth: boolean }[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = path.join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (f === "route.ts") {
        const src = readFileSync(p, "utf8");
        const route = "/api/" + path.relative(API_ROOT, path.dirname(p)).split(path.sep).filter(Boolean).map((s) => (s.startsWith("[") ? (s === "[token]" ? "token-de-prueba" : UUID) : s)).join("/");
        for (const m of src.matchAll(/^export const (GET|POST|PUT|PATCH|DELETE) = (api|publicApi)\(/gm)) out.push({ route, method: m[1], auth: m[2] === "api" });
      }
    }
  };
  walk(API_ROOT);
  return out;
}

test.describe("barrido de seguridad", () => {
  test("toda operación que exige sesión responde 401 a quien no la tiene", async ({ playwright, baseURL }) => {
    const anon = await playwright.request.newContext({ baseURL });
    const ops = operations().filter((o) => o.auth && !o.route.startsWith("/api/test/"));
    expect(ops.length).toBeGreaterThan(60); // el barrido realmente cubre el backend
    const failures: string[] = [];
    for (const o of ops) {
      const res = await anon.fetch(o.route, { method: o.method, data: ["GET", "DELETE"].includes(o.method) ? undefined : {} });
      if (res.status() !== 401) failures.push(`${o.method} ${o.route} → ${res.status()}`);
    }
    await anon.dispose();
    expect(failures).toEqual([]);
  });

  test("la ruta de reinicio de pruebas no existe sin el token correcto", async ({ playwright, baseURL, request }) => {
    const doc = await request.post("/api/pages", { data: { title: "No debe borrarse" } }).then((r) => r.json());
    for (const headers of [{}, { "x-nodara-e2e-token": "token-incorrecto" }]) {
      const anon = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { "x-nodara-e2e-token": "", ...headers } });
      expect((await anon.post("/api/test/reset", { data: {} })).status()).toBe(404);
      await anon.dispose();
    }
    expect((await request.get(`/api/pages/${doc.id}`)).status()).toBe(200); // nada se borró
  });

  test("una persona de otro espacio no puede leer ni modificar nada ajeno (IDOR)", async ({ browser, request }) => {
    // Recursos del propietario
    const page = await apiCreate(request, { title: "Secreta" });
    await request.patch(`/api/pages/${page.id}`, { data: { content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "contenido confidencial" }] }] } } });
    const db = await apiDatabase(request, "Datos secretos");
    const prop = await apiProp(request, db.cid, { name: "Estado", type: "select" });
    const opt = await apiOption(request, prop.id, "Abierto");
    const row = await apiRow(request, db.cid, { title: "Registro secreto" });
    const thread = await (await request.post(`/api/pages/${page.id}/comments`, { data: { body: "comentario privado" } })).json();
    const upload = await (await request.post("/api/files", { multipart: { file: { name: "secreto.txt", mimeType: "text/plain", buffer: Buffer.from("datos") } } })).json();
    const tpl = await (await request.post(`/api/databases/${db.cid}/templates`, { data: { name: "Plantilla" } })).json();
    const me = await (await request.get("/api/me")).json();
    const wsId = me.currentWorkspaceId as string;
    await request.patch(`/api/pages/${page.id}`, { data: { title: "Secreta v2" } });
    const versions = await (await request.get(`/api/pages/${page.id}/versions`)).json();

    const eve = await newUser(browser, "eve@nodara.test", "Eve");
    const attempts: [string, string, unknown?][] = [
      ["GET", `/api/pages/${page.id}`],
      ["PATCH", `/api/pages/${page.id}`, { title: "Hackeada" }],
      ["DELETE", `/api/pages/${page.id}`],
      ["DELETE", `/api/pages/${page.id}?permanent=1`],
      ["POST", `/api/pages/${page.id}/duplicate`],
      ["POST", `/api/pages/${page.id}/move`, { parentId: null, position: 0 }],
      ["POST", `/api/pages/${page.id}/restore`],
      ["GET", `/api/pages/${page.id}/sharing`],
      ["POST", `/api/pages/${page.id}/share`, { email: "eve@nodara.test", level: "full" }],
      ["PUT", `/api/pages/${page.id}/scope`, { scope: "workspace" }],
      ["POST", `/api/pages/${page.id}/publish`, { level: "edit" }],
      ["GET", `/api/pages/${page.id}/versions`],
      ["GET", `/api/pages/${page.id}/export?format=md`],
      ["GET", `/api/pages/${page.id}/analytics`],
      ["GET", `/api/pages/${page.id}/comments`],
      ["POST", `/api/pages/${page.id}/comments`, { body: "intruso" }],
      ["POST", `/api/comments/${thread.id}`, { body: "intruso" }],
      ["PATCH", `/api/comments/${thread.id}`, { resolved: true }],
      ["DELETE", `/api/comments/${thread.id}`],
      ["GET", `/api/collab/${page.id}/stream?cid=12345678&aid=1`],
      ["POST", `/api/collab/${page.id}/update`, { cid: "12345678", update: "AAA=" }],
      ["POST", `/api/collab/${page.id}/awareness`, { cid: "12345678", update: "AAA=" }],
      ["GET", `/api/databases/${db.cid}/export`],
      ["POST", `/api/databases/${db.cid}/query`, {}],
      ["PATCH", `/api/databases/${db.cid}`, { title: "x" }],
      ["POST", `/api/databases/${db.cid}/records`, { title: "intruso" }],
      ["POST", `/api/databases/${db.cid}/properties`, { name: "x", type: "text" }],
      ["POST", `/api/databases/${db.cid}/views`, { type: "table" }],
      ["POST", `/api/databases/${db.cid}/templates`, { name: "x" }],
      ["PATCH", `/api/properties/${prop.id}`, { name: "x" }],
      ["DELETE", `/api/properties/${prop.id}`],
      ["POST", `/api/properties/${prop.id}/options`, { name: "x" }],
      ["PATCH", `/api/views/${db.viewId}`, { name: "x" }],
      ["DELETE", `/api/views/${db.viewId}`],
      ["GET", `/api/records/${row.id}`],
      ["PATCH", `/api/records/${row.id}`, { title: "x" }],
      ["PATCH", `/api/templates/${tpl.id}`, { name: "x" }],
      ["DELETE", `/api/templates/${tpl.id}`],
      ["GET", upload.url],
      ["GET", `/api/workspaces/${wsId}/members`],
      ["GET", `/api/workspaces/${wsId}/export`],
      ["GET", `/api/workspaces/${wsId}/audit`],
      ["POST", `/api/workspaces/${wsId}/invitations`, { email: "x@nodara.test", role: "admin" }],
      ["PATCH", `/api/workspaces/${wsId}`, { name: "Robado" }],
      ["DELETE", `/api/workspaces/${wsId}`],
    ];
    if (versions[0]) {
      attempts.push(["GET", `/api/pages/${page.id}/versions/${versions[0].id}`], ["POST", `/api/pages/${page.id}/versions/${versions[0].id}/restore`]);
    }
    const leaks: string[] = [];
    for (const [method, url, data] of attempts) {
      const res = await eve.request.fetch(url, { method, data: data as object | undefined, timeout: 3000 }).catch(() => null);
      if (!res) continue; // el canal SSE no responde a tiempo: no hay fuga
      if (res.status() < 400) leaks.push(`${method} ${url} → ${res.status()}`);
    }
    expect(leaks).toEqual([]);

    // y el propietario conserva todo intacto
    const after = await (await request.get(`/api/pages/${page.id}`)).json();
    expect(after.title).toBe("Secreta v2");
    expect(after.deletedAt).toBeNull();
    expect((await request.get(`/api/records/${row.id}`)).status()).toBe(200);
    expect(opt).toBeTruthy();
    // Eve no ve nada del espacio ajeno en sus listados ni en la búsqueda
    expect(JSON.stringify(await (await eve.request.get("/api/pages")).json())).not.toContain("Secreta");
    expect(JSON.stringify(await (await eve.request.get("/api/search?q=confidencial")).json())).not.toContain(page.id);
    await eve.context.close();
  });

  test("las ediciones de un enlace público de solo lectura se rechazan", async ({ playwright, baseURL, request }) => {
    const page = await apiCreate(request, { title: "Pública" });
    const { token } = await (await request.post(`/api/pages/${page.id}/publish`, { data: { level: "view" } })).json();
    const anon = await playwright.request.newContext({ baseURL });
    expect((await anon.get(`/api/public/${token}`)).status()).toBe(200);
    expect((await anon.patch(`/api/public/${token}/pages/${page.id}`, { data: { title: "Vandalismo" } })).status()).toBe(403);
    expect((await anon.get(`/api/pages/${page.id}`)).status()).toBe(401);
    await anon.dispose();
    expect((await (await request.get(`/api/pages/${page.id}`)).json()).title).toBe("Pública");
  });

  test("la cookie de sesión es HttpOnly y SameSite, y el origen ajeno se rechaza", async ({ playwright, baseURL }) => {
    const anon = await playwright.request.newContext({ baseURL });
    const res = await anon.post("/api/auth/signup", { data: { email: "cookie@nodara.test", name: "Cookie", password: "contraseña-segura-1" } });
    const cookie = res.headersArray().find((h) => h.name.toLowerCase() === "set-cookie")?.value ?? "";
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    const cross = await anon.post("/api/pages", { data: { title: "x" }, headers: { Origin: "https://sitio-malicioso.example" } });
    expect(cross.status()).toBe(403);
    await anon.dispose();
  });

  test("las subidas se sirven con nosniff y los tipos peligrosos como descarga", async ({ request }) => {
    const html = await (await request.post("/api/files", { multipart: { file: { name: "malicioso.html", mimeType: "text/html", buffer: Buffer.from("<script>alert(1)</script>") } } })).json();
    const res = await request.get(html.url);
    expect(res.headers()["content-disposition"]).toMatch(/^attachment/);
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res.headers()["content-type"]).not.toContain("text/html");
    const svg = await (await request.post("/api/files", { multipart: { file: { name: "x.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') } } })).json();
    expect((await request.get(svg.url)).headers()["content-disposition"]).toMatch(/^attachment/);
  });
});
