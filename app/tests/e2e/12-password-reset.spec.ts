import { expect, gotoReady, newUser, test } from "./fixtures";
import type { APIRequestContext } from "@playwright/test";

/** El propietario invita a `email` (que ya tiene cuenta) y la persona acepta la invitación. */
async function joinWorkspace(owner: APIRequestContext, member: APIRequestContext, email: string, role = "member") {
  const wsId = (await (await owner.get("/api/me")).json()).currentWorkspaceId as string;
  const inv = await (await owner.post(`/api/workspaces/${wsId}/invitations`, { data: { email, role } })).json();
  expect((await member.post(`/api/invitations/${inv.token}/accept`)).status()).toBe(200);
  return wsId;
}

test.describe("restablecer contraseña con enlace de administrador", () => {
  test("flujo completo: el enlace cambia la contraseña, cierra sesiones y no se puede reutilizar", async ({ page, browser, request }) => {
    const ana = await newUser(browser, "ana@nodara.test", "Ana");
    const wsId = await joinWorkspace(request, ana.request, "ana@nodara.test");
    const members = await (await request.get(`/api/workspaces/${wsId}/members`)).json();
    const anaId = members.members.find((m: { email: string }) => m.email === "ana@nodara.test").userId as string;

    const res = await request.post(`/api/workspaces/${wsId}/members/${anaId}/reset`);
    expect(res.status()).toBe(201);
    const { path, email } = await res.json();
    expect(email).toBe("ana@nodara.test");
    expect(path).toMatch(/^\/reset\/[\w-]{20,}$/);

    // el enlace muestra a qué cuenta pertenece y acepta una contraseña válida
    await page.goto(path); // página pública: no pasa por AuthGate
    await expect(page.getByText("Cuenta: ana@nodara.test")).toBeVisible();
    // una contraseña corta ni siquiera se envía (validación del navegador); el servidor la rechaza igualmente
    const short = await page.request.post(path.replace("/reset/", "/api/auth/reset/"), { data: { password: "corta" } });
    expect(short.status()).toBe(400);
    await page.getByLabel("Contraseña nueva").fill("clave-nueva-2026");
    await page.getByLabel("Repite la contraseña").fill("otra-distinta-1");
    await page.getByTestId("reset-submit").click();
    await expect(page.getByTestId("reset-page").getByRole("alert")).toContainText("no coinciden");
    await page.getByLabel("Repite la contraseña").fill("clave-nueva-2026");
    await page.getByTestId("reset-submit").click();
    await expect(page.getByTestId("reset-login")).toBeVisible();

    // la sesión anterior de Ana dejó de valer y la contraseña vieja ya no sirve
    expect((await ana.request.get("/api/me")).status()).toBe(401);
    const old = await ana.request.post("/api/auth/login", { data: { email: "ana@nodara.test", password: "contraseña-segura-1" } });
    expect(old.status()).toBe(401);
    const ok = await ana.request.post("/api/auth/login", { data: { email: "ana@nodara.test", password: "clave-nueva-2026" } });
    expect(ok.status()).toBe(200);

    // el enlace es de un solo uso
    const again = await request.get(path.replace("/reset/", "/api/auth/reset/"));
    expect(again.status()).toBe(404);
    const reuse = await request.post(path.replace("/reset/", "/api/auth/reset/"), { data: { password: "otra-clave-9999" } });
    expect(reuse.status()).toBe(404);
    await ana.context.close();
  });

  test("solo administradores pueden generarlo y nunca sobre sí mismos ni sobre ajenos al espacio", async ({ browser, request }) => {
    const ana = await newUser(browser, "ana@nodara.test", "Ana");
    const luis = await newUser(browser, "luis@nodara.test", "Luis");
    const wsId = await joinWorkspace(request, ana.request, "ana@nodara.test");
    const me = await (await request.get("/api/me")).json();
    const members = (await (await request.get(`/api/workspaces/${wsId}/members`)).json()).members as { email: string; userId: string }[];
    const anaId = members.find((m) => m.email === "ana@nodara.test")!.userId;
    // una persona sin rol de administración: 403
    expect((await ana.request.post(`/api/workspaces/${wsId}/members/${me.user.id}/reset`)).status()).toBe(403);
    // sobre sí mismo: 400
    expect((await request.post(`/api/workspaces/${wsId}/members/${me.user.id}/reset`)).status()).toBe(400);
    // alguien que no pertenece al espacio: 404
    expect((await request.post(`/api/workspaces/${wsId}/members/${luis.user.id}/reset`)).status()).toBe(404);
    // un administrador no puede restablecer a un propietario
    await request.patch(`/api/workspaces/${wsId}/members/${anaId}`, { data: { role: "admin" } });
    expect((await ana.request.post(`/api/workspaces/${wsId}/members/${me.user.id}/reset`)).status()).toBe(403);
    // token inventado
    expect((await request.get("/api/auth/reset/token-inventado-que-no-existe")).status()).toBe(404);
    await ana.context.close();
    await luis.context.close();
  });

  test("un enlace nuevo invalida el anterior y la acción queda en la auditoría", async ({ browser, request }) => {
    const ana = await newUser(browser, "ana@nodara.test", "Ana");
    const wsId = await joinWorkspace(request, ana.request, "ana@nodara.test");
    const members = (await (await request.get(`/api/workspaces/${wsId}/members`)).json()).members as { email: string; userId: string }[];
    const anaId = members.find((m) => m.email === "ana@nodara.test")!.userId;
    const first = await (await request.post(`/api/workspaces/${wsId}/members/${anaId}/reset`)).json();
    const second = await (await request.post(`/api/workspaces/${wsId}/members/${anaId}/reset`)).json();
    expect((await request.get(first.path.replace("/reset/", "/api/auth/reset/"))).status()).toBe(404);
    expect((await request.get(second.path.replace("/reset/", "/api/auth/reset/"))).status()).toBe(200);
    const audit = await (await request.get(`/api/workspaces/${wsId}/audit?action=member.reset_password`)).json();
    expect(audit).toHaveLength(2);
    await ana.context.close();
  });

  test("desde Configuración → Miembros se genera un enlace copiable", async ({ page, browser, request }) => {
    const ana = await newUser(browser, "ana@nodara.test", "Ana");
    await joinWorkspace(request, ana.request, "ana@nodara.test");
    await gotoReady(page, "/");
    await page.getByTestId("workspace-switcher").click();
    await page.getByTestId("invite-members").click();
    await page.locator('[data-email="ana@nodara.test"]').getByTestId("reset-password").click();
    await expect(page.getByTestId("reset-link")).toContainText("/reset/");
    await ana.context.close();
  });
});
