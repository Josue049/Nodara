import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createSession, HttpError, userForToken, verifyPassword } from "@/server/auth";
import { visiblePages } from "@/server/authz";
import { createDb, type Db } from "@/server/db";
import { claimGuest, createGuest, deleteGuest, purgeExpiredGuests, upgradeGuest } from "@/server/guest-service";
import { createPage } from "@/server/pages-service";
import { pages, sessions, users, workspaces } from "@/server/schema";
import { listWorkspaces, registerUser } from "@/server/workspaces-service";

let db: Db;
beforeEach(async () => {
  db = await createDb("memory://");
});

const guestWithPage = async (title = "Mi proyecto") => {
  const guest = await createGuest(db);
  const [ws] = await listWorkspaces(db, guest.id);
  const page = await createPage(db, { title, workspaceId: ws.id, creatorId: guest.id, scope: "private" });
  return { guest, ws, page };
};

describe("modo sin cuenta", () => {
  it("crea una cuenta temporal con su espacio, marcada en la sesión y sin posibilidad de iniciar sesión", async () => {
    const guest = await createGuest(db);
    expect(guest.isGuest).toBe(true);
    const { token } = await createSession(db, guest.id);
    expect((await userForToken(db, token))?.isGuest).toBe(true);
    const [row] = await db.select().from(users).where(eq(users.id, guest.id));
    expect(row.email.endsWith("@invitado.invalid")).toBe(true);
    expect(await verifyPassword("", row.passwordHash)).toBe(false);
    expect(await listWorkspaces(db, guest.id)).toHaveLength(1);
  });

  it("al registrarse conserva las páginas y la cuenta deja de ser temporal", async () => {
    const { guest, ws, page } = await guestWithPage();
    const out = await upgradeGuest(db, guest.id, { email: "Lucia@Nodara.test", name: "Lucía", password: "contraseña-segura" });
    expect(out.user).toMatchObject({ id: guest.id, email: "lucia@nodara.test", isGuest: false });
    expect(out.workspace?.name).toBe("Espacio de Lucía");
    expect((await visiblePages(db, out.user.id, ws.id)).map((p) => p.id)).toContain(page.id);
    // Correo ya usado: 409 y la cuenta temporal sigue intacta.
    const other = await createGuest(db);
    const err = await upgradeGuest(db, other.id, { email: "lucia@nodara.test", name: "X", password: "contraseña-segura" }).catch((e) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(409);
  });

  it("al iniciar sesión en otra cuenta, los espacios con contenido pasan a ella y la temporal desaparece", async () => {
    const real = (await registerUser(db, { email: "ana@nodara.test", name: "Ana", password: "contraseña-segura" })).user;
    const { guest, ws, page } = await guestWithPage();
    expect(await claimGuest(db, guest.id, real.id)).toBe(ws.id);
    const spaces = await listWorkspaces(db, real.id);
    expect(spaces.map((w) => w.name)).toContain("Trabajo sin cuenta");
    const [p] = await db.select().from(pages).where(eq(pages.id, page.id));
    expect(p.creatorId).toBe(real.id);
    expect((await visiblePages(db, real.id, ws.id)).map((x) => x.id)).toContain(page.id);
    expect(await db.select().from(users).where(eq(users.id, guest.id))).toHaveLength(0);
  });

  it("un invitado sin contenido no deja espacios vacíos al iniciar sesión", async () => {
    const real = (await registerUser(db, { email: "ana@nodara.test", name: "Ana", password: "contraseña-segura" })).user;
    const guest = await createGuest(db);
    expect(await claimGuest(db, guest.id, real.id)).toBeNull();
    expect(await listWorkspaces(db, real.id)).toHaveLength(1);
    expect(await db.select().from(workspaces)).toHaveLength(1);
  });

  it("descartar o caducar borra la cuenta temporal con sus espacios y páginas, nunca una cuenta real", async () => {
    const { guest, ws } = await guestWithPage();
    await deleteGuest(db, guest.id);
    expect(await db.select().from(workspaces).where(eq(workspaces.id, ws.id))).toHaveLength(0);
    expect(await db.select().from(pages)).toHaveLength(0);

    const real = (await registerUser(db, { email: "ana@nodara.test", name: "Ana", password: "contraseña-segura" })).user;
    await deleteGuest(db, real.id);
    expect(await listWorkspaces(db, real.id)).toHaveLength(1);

    const stale = await guestWithPage("Caducada");
    const live = await createGuest(db);
    await createSession(db, live.id);
    const fresh = await createGuest(db); // recién creada y aún sin sesión: no se toca
    await createSession(db, stale.guest.id);
    await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.userId, stale.guest.id));
    await db.update(users).set({ createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000) }).where(eq(users.id, stale.guest.id));
    expect(await purgeExpiredGuests(db)).toBe(1);
    expect(await db.select().from(users).where(eq(users.id, fresh.id))).toHaveLength(1);
    expect(await db.select().from(users).where(eq(users.id, live.id))).toHaveLength(1);
    expect(await db.select().from(users).where(eq(users.id, stale.guest.id))).toHaveLength(0);
  });
});
