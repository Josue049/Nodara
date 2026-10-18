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
