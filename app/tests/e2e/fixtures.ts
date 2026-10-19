import { expect, test as base, type APIRequestContext, type Page } from "@playwright/test";

type ApiPage = { id: string; title: string; parentId: string | null };

/** Cada prueba parte de una base vacía (reset automático) y crea sus propios datos. */
export const test = base.extend<{ reset: void }>({
  reset: [
    async ({ request }, use) => {
      const res = await request.post("/api/test/reset");
      expect(res.status()).toBe(204);
      await use();
    },
    { auto: true },
  ],
});
export { expect };

export async function apiCreate(
  request: APIRequestContext,
  data: { title?: string; parentId?: string | null; icon?: string | null },
): Promise<ApiPage> {
  const res = await request.post("/api/pages", { data });
  expect(res.status()).toBe(201);
  return res.json();
}

export const sidebarRow = (page: Page, title: string | RegExp) =>
  page.getByTestId("sidebar-page").filter({ hasText: title });

// ── Bases de datos ───────────────────────────────────────────────────
type Json = Record<string, unknown>;

export async function apiDatabase(request: APIRequestContext, title = "Base de prueba") {
  const res = await request.post("/api/databases", { data: {} });
  expect(res.status()).toBe(201);
  const db = await res.json();
  await request.patch(`/api/pages/${db.page.id}`, { data: { title } });
  return { pageId: db.page.id as string, cid: db.collection.id as string, viewId: db.views[0].id as string };
}

export async function apiProp(request: APIRequestContext, cid: string, data: Json) {
  const res = await request.post(`/api/databases/${cid}/properties`, { data });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()) as { id: string; name: string; config: Json };
}

export async function apiOption(request: APIRequestContext, propId: string, name: string) {
  const res = await request.post(`/api/properties/${propId}/options`, { data: { name } });
  expect(res.status()).toBe(201);
  return (await res.json()).option.id as string;
}

export async function apiRow(request: APIRequestContext, cid: string, data: { title?: string; properties?: Json }) {
  const res = await request.post(`/api/databases/${cid}/records`, { data });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()) as { id: string };
}

export async function apiQuery(request: APIRequestContext, cid: string, body: Json = {}) {
  const res = await request.post(`/api/databases/${cid}/query`, { data: body });
  expect(res.status()).toBe(200);
  return (await res.json()) as { rows: { id: string; title: string; values: Record<string, unknown> }[]; bundle: { views: { id: string; type: string; config: Json }[]; properties: { id: string; name: string }[] }; groups?: { key: string; rowIds: string[] }[] };
}

export const dbRows = (page: Page) => page.getByTestId("db-row");
export const rowByTitle = (page: Page, title: string) => page.getByTestId("db-row").filter({ has: page.getByTestId("row-title").filter({ hasText: new RegExp(`^${title}$`) }) });

/** Navega y espera a que la app esté hidratada y haya cargado el árbol de páginas. */
export async function gotoReady(page: Page, url: string) {
  await page.goto(url);
  await page.locator("html[data-nodara-ready]").waitFor({ state: "attached" });
}
