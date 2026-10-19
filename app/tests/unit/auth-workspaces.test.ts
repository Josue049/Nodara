import { beforeEach, describe, expect, it } from "vitest";
import { createSession, destroySession, hashPassword, HttpError, rateLimit, resetRateLimit, userForToken, verifyPassword } from "@/server/auth";
import { assertPage, memberRole, pageAccess, visiblePages } from "@/server/authz";
import { addRecord, createDatabase } from "@/server/collections-service";
import { createDb, type Db } from "@/server/db";
import { createPage, listTrash, searchPages, trashPage, updatePage } from "@/server/pages-service";
import { favorites, sessions } from "@/server/schema";
import { isWithinShared, listVersions, maybeSnapshot, publishPage, resolveShare, restoreVersion, setFavorite, setPermission, setScope, sharePage, sharingInfo, unpublishPage } from "@/server/sharing-service";
import { acceptInvitation, createInvitation, createWorkspace, getInvitation, listMembers, listWorkspaces, registerUser, removeMember, setMemberRole } from "@/server/workspaces-service";

let db: Db;
beforeEach(async () => {
  process.env.NODARA_VERSION_INTERVAL_MS = "0";
  db = await createDb("memory://");
});

const signup = async (email: string, name = email.split("@")[0]) => (await registerUser(db, { email, name, password: "contraseña-segura" })).user;
const rejects = async (p: Promise<unknown>, status: number) => {
  const err = await p.then(
    () => null,
    (e) => e,
  );
  expect(err).toBeInstanceOf(HttpError);
  expect((err as HttpError).status).toBe(status);
};

describe("contraseñas y sesiones", () => {
  it("scrypt: verifica y rechaza; los hashes son distintos para la misma contraseña", async () => {
    const a = await hashPassword("hunter2hunter2");
    const b = await hashPassword("hunter2hunter2");
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("hunter2hunter2", a)).toBe(true);
    expect(await verifyPassword("otra-cosa", a)).toBe(false);
    expect(await verifyPassword("x", "basura")).toBe(false);
  });

  it("la sesión guarda solo el hash del token, caduca y se destruye", async () => {
    const u = await signup("ana@nodara.test");
    const { token } = await createSession(db, u.id);
    const [row] = await db.select().from(sessions);
    expect(row.tokenHash).not.toBe(token);
    expect(row.tokenHash).toHaveLength(64);
    expect((await userForToken(db, token))?.id).toBe(u.id);
    expect(await userForToken(db, token + "x")).toBeNull();
    await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) });
    expect(await userForToken(db, token)).toBeNull();
    const second = await createSession(db, u.id);
    await destroySession(db, second.token);
    expect(await userForToken(db, second.token)).toBeNull();
  });

  it("limitador de intentos", () => {
    for (let i = 0; i < 3; i++) rateLimit("k", 3, 60_000);
    expect(() => rateLimit("k", 3, 60_000)).toThrow(HttpError);
    resetRateLimit("k");
    expect(() => rateLimit("k", 3, 60_000)).not.toThrow();
  });
});

describe("registro y adopción de datos previos", () => {
  it("el primer usuario adopta las páginas existentes (y sus favoritos); el segundo no", async () => {
    const old = await createPage(db, { title: "Anterior" });
    await createPage(db, { title: "Hija", parentId: old.id });
    await updatePage(db, old.id, { isFavorite: true });
    const first = await registerUser(db, { email: "uno@nodara.test", name: "Uno", password: "contraseña-segura" });
    expect(first.adopted).toBe(2);
    const vis = await visiblePages(db, first.user.id, first.workspace.id);
    expect(vis.map((p) => p.title).sort()).toEqual(["Anterior", "Hija"]);
    expect(vis.find((p) => p.title === "Anterior")!.isFavorite).toBe(true);
    const second = await registerUser(db, { email: "dos@nodara.test", name: "Dos", password: "contraseña-segura" });
    expect(second.adopted).toBe(0);
    expect(await visiblePages(db, second.user.id, second.workspace.id)).toHaveLength(0);
    expect((await db.select().from(favorites)).length).toBe(1);
  });

  it("rechaza correos repetidos sin distinguir mayúsculas", async () => {
    await signup("rep@nodara.test");
    await rejects(registerUser(db, { email: "REP@nodara.test", name: "X", password: "contraseña-segura" }), 409);
  });
});

describe("permisos de página", () => {
  async function setup() {
    const owner = await registerUser(db, { email: "owner@nodara.test", name: "Owner", password: "contraseña-segura" });
    const ws = owner.workspace.id;
    const member = await signup("member@nodara.test");
    const guest = await signup("guest@nodara.test");
    const outsider = await signup("out@nodara.test");
    const inv = await createInvitation(db, owner.user, ws, { email: "member@nodara.test", role: "member" });
    await acceptInvitation(db, member, inv.token);
    const root = await createPage(db, { title: "Privada", workspaceId: ws, creatorId: owner.user.id, scope: "private" });
    const child = await createPage(db, { title: "Hija", parentId: root.id, creatorId: owner.user.id });
    return { owner: owner.user, ws, member, guest, outsider, root, child };
  }

  it("una página privada solo la ve su autor", async () => {
    const { owner, member, outsider, root, child } = await setup();
    expect((await pageAccess(db, owner.id, child.id))!.level).toBe("full");
    expect((await pageAccess(db, member.id, root.id))!.level).toBe("none");
    expect((await pageAccess(db, outsider.id, root.id))!.level).toBe("none");
    await rejects(assertPage(db, member, root.id, "view"), 404); // no se revela su existencia
    expect(await pageAccess(db, owner.id, "00000000-0000-4000-8000-000000000000")).toBeNull();
  });

  it("alcance «workspace»: los miembros editan, los administradores tienen acceso completo y los invitados nada", async () => {
    const { owner, ws, member, root, child } = await setup();
    await setScope(db, owner, root.id, "workspace");
    expect((await pageAccess(db, member.id, child.id))!.level).toBe("edit"); // hereda
    expect(await memberRole(db, member.id, ws)).toBe("member");
    await rejects(assertPage(db, member, root.id, "full"), 403);
    await setMemberRole(db, owner, ws, member.id, "admin");
    expect((await pageAccess(db, member.id, root.id))!.level).toBe("full");
    await setMemberRole(db, owner, ws, member.id, "guest");
    expect((await pageAccess(db, member.id, root.id))!.level).toBe("none");
  });

  it("una subpágina privada dentro de un espacio compartido no hereda el alcance del padre", async () => {
    const { owner, member, root, child } = await setup();
    await setScope(db, owner, root.id, "workspace");
    await setScope(db, owner, child.id, "private");
    expect((await pageAccess(db, member.id, root.id))!.level).toBe("edit");
    expect((await pageAccess(db, member.id, child.id))!.level).toBe("none");
  });

  it("permiso explícito: se hereda a descendientes y se retira", async () => {
    const { owner, member, root, child } = await setup();
    expect(await sharePage(db, owner, root.id, { email: "member@nodara.test", level: "comment" })).toMatchObject({ status: "shared" });
    expect((await pageAccess(db, member.id, child.id))!.level).toBe("comment");
    await rejects(assertPage(db, member, child.id, "edit"), 403);
    await setPermission(db, owner, root.id, member.id, "edit");
    expect((await assertPage(db, member, child.id, "edit")).level).toBe("edit");
    await setPermission(db, owner, root.id, member.id, null);
    expect((await pageAccess(db, member.id, child.id))!.level).toBe("none");
  });

  it("compartir con un usuario externo lo añade como invitado solo a esa página", async () => {
    const { owner, ws, outsider, root, child } = await setup();
    await sharePage(db, owner, child.id, { email: "out@nodara.test", level: "view" });
    expect(await memberRole(db, outsider.id, ws)).toBe("guest");
    expect((await pageAccess(db, outsider.id, child.id))!.level).toBe("view");
    expect((await pageAccess(db, outsider.id, root.id))!.level).toBe("none");
    const vis = await visiblePages(db, outsider.id, ws);
    expect(vis.map((p) => p.title)).toEqual(["Hija"]);
    await rejects(sharePage(db, outsider, child.id, { email: "member@nodara.test", level: "view" }), 403);
  });

  it("compartir con un correo sin cuenta crea una invitación con enlace", async () => {
    const { owner, root } = await setup();
    const r = await sharePage(db, owner, root.id, { email: "nuevo@nodara.test", level: "edit" });
    expect(r.status).toBe("invited");
    const info = await sharingInfo(db, owner, root.id);
    expect(info.people.map((p) => p.name)).toEqual(["Owner"]);
  });

  it("no se puede rebajar el acceso del autor", async () => {
    const { owner, root } = await setup();
    await rejects(setPermission(db, owner, root.id, owner.id, "view"), 409);
  });

  it("los registros de una base heredan el acceso de su página anfitriona", async () => {
    const { owner, member, ws } = await setup();
    const { collection, page } = await createDatabase(db, { title: "Tareas", workspaceId: ws, creatorId: owner.id });
    const rec = await addRecord(db, collection.id, { title: "Fila", creatorId: owner.id });
    expect((await pageAccess(db, member.id, rec.id))!.level).toBe("none");
    await setScope(db, owner, page.id, "workspace");
    expect((await pageAccess(db, member.id, rec.id))!.level).toBe("edit");
  });

  it("búsqueda y papelera solo muestran lo accesible", async () => {
    const { owner, ws, member, root, child } = await setup();
    const open = await createPage(db, { title: "Visible para todos", workspaceId: ws, creatorId: owner.id, scope: "workspace" });
    const allowed = new Set((await visiblePages(db, member.id, ws)).map((p) => p.id));
    expect((await searchPages(db, "", { workspaceId: ws, allowed })).map((r) => r.title)).toEqual(["Visible para todos"]);
    await trashPage(db, root.id);
    await trashPage(db, open.id);
    void child;
    const trash = await listTrash(db, ws);
    expect(trash.map((t) => t.title).sort()).toEqual(["Privada", "Visible para todos"]);
  });

  it("favoritos por usuario", async () => {
    const { owner, ws, member, root } = await setup();
    await setScope(db, owner, root.id, "workspace");
    await setFavorite(db, owner, root.id, true);
    expect((await visiblePages(db, owner.id, ws)).find((p) => p.id === root.id)!.isFavorite).toBe(true);
    expect((await visiblePages(db, member.id, ws)).find((p) => p.id === root.id)!.isFavorite).toBe(false);
    await setFavorite(db, owner, root.id, false);
    expect((await visiblePages(db, owner.id, ws)).find((p) => p.id === root.id)!.isFavorite).toBe(false);
  });
});

describe("espacios de trabajo, roles e invitaciones", () => {
  it("crear espacio: el creador es propietario; el espacio se lista con su rol", async () => {
    const u = await signup("a@nodara.test");
    const w = await createWorkspace(db, u, "Equipo B");
    const list = await listWorkspaces(db, u.id);
    expect(list.map((x) => [x.name, x.role])).toEqual([["Espacio de a", "owner"], ["Equipo B", "owner"]]);
    expect(w.memberCount).toBe(1);
  });

  it("invitación: un solo uso, caduca, no degrada a un miembro y respeta el rol", async () => {
    const owner = await registerUser(db, { email: "o@nodara.test", name: "O", password: "contraseña-segura" });
    const guy = await signup("g@nodara.test");
    const inv = await createInvitation(db, owner.user, owner.workspace.id, { email: "g@nodara.test", role: "admin" });
    expect((await getInvitation(db, inv.token)).workspaceName).toContain("Espacio");
    await acceptInvitation(db, guy, inv.token);
    expect(await memberRole(db, guy.id, owner.workspace.id)).toBe("admin");
    await rejects(acceptInvitation(db, guy, inv.token), 410);
    const lower = await createInvitation(db, owner.user, owner.workspace.id, { email: "g@nodara.test", role: "guest" });
    await acceptInvitation(db, guy, lower.token);
    expect(await memberRole(db, guy.id, owner.workspace.id)).toBe("admin"); // sin degradar
    await rejects(getInvitation(db, "token-inexistente"), 404);
  });

  it("solo propietarios gestionan propietarios y siempre queda uno", async () => {
    const owner = await registerUser(db, { email: "o2@nodara.test", name: "O", password: "contraseña-segura" });
    const ws = owner.workspace.id;
    const admin = await signup("ad@nodara.test");
    const member = await signup("me@nodara.test");
    await acceptInvitation(db, admin, (await createInvitation(db, owner.user, ws, { email: "ad@nodara.test", role: "admin" })).token);
    await acceptInvitation(db, member, (await createInvitation(db, owner.user, ws, { email: "me@nodara.test", role: "member" })).token);
    await rejects(createInvitation(db, member, ws, { email: "x@nodara.test", role: "member" }), 403); // los miembros no invitan al espacio
    await rejects(createInvitation(db, admin, ws, { email: "x@nodara.test", role: "owner" }), 403);
    await rejects(setMemberRole(db, admin, ws, owner.user.id, "member"), 403);
    await rejects(removeMember(db, admin, ws, owner.user.id), 403);
    await rejects(setMemberRole(db, owner.user, ws, owner.user.id, "member"), 409); // último propietario
    await rejects(removeMember(db, owner.user, ws, owner.user.id), 409);
    await setMemberRole(db, owner.user, ws, admin.id, "owner");
    await setMemberRole(db, owner.user, ws, owner.user.id, "member");
    expect((await listMembers(db, admin, ws)).find((m) => m.userId === admin.id)!.role).toBe("owner");
  });

  it("al quitar a un miembro se eliminan sus permisos y favoritos del espacio", async () => {
    const owner = await registerUser(db, { email: "o3@nodara.test", name: "O", password: "contraseña-segura" });
    const ws = owner.workspace.id;
    const m = await signup("m3@nodara.test");
    await acceptInvitation(db, m, (await createInvitation(db, owner.user, ws, { email: "m3@nodara.test", role: "member" })).token);
    const page = await createPage(db, { title: "P", workspaceId: ws, creatorId: owner.user.id, scope: "private" });
    await sharePage(db, owner.user, page.id, { email: "m3@nodara.test", level: "edit" });
    await setFavorite(db, m, page.id, true);
    await removeMember(db, owner.user, ws, m.id);
    expect(await memberRole(db, m.id, ws)).toBeNull();
    expect((await pageAccess(db, m.id, page.id))!.level).toBe("none");
    expect((await db.select().from(favorites)).length).toBe(0);
  });

  it("los invitados no ven los correos de los demás", async () => {
    const owner = await registerUser(db, { email: "o4@nodara.test", name: "O", password: "contraseña-segura" });
    const g = await signup("g4@nodara.test");
    await acceptInvitation(db, g, (await createInvitation(db, owner.user, owner.workspace.id, { email: "g4@nodara.test", role: "guest" })).token);
    const list = await listMembers(db, g, owner.workspace.id);
    expect(list.find((m) => m.userId === owner.user.id)!.email).toBe("");
    expect(list.find((m) => m.userId === g.id)!.email).toBe("g4@nodara.test");
  });
});

describe("enlaces públicos y versiones", () => {
  it("publicar genera un token estable; el enlace cubre el subárbol; se puede retirar", async () => {
    const owner = await registerUser(db, { email: "p@nodara.test", name: "P", password: "contraseña-segura" });
    const root = await createPage(db, { title: "Pública", workspaceId: owner.workspace.id, creatorId: owner.user.id });
    const child = await createPage(db, { title: "Hija", parentId: root.id });
    const other = await createPage(db, { title: "Ajena", workspaceId: owner.workspace.id, creatorId: owner.user.id });
    const a = await publishPage(db, owner.user, root.id, "view");
    const b = await publishPage(db, owner.user, root.id, "comment");
    expect(b.token).toBe(a.token);
    expect(await resolveShare(db, a.token)).toEqual({ pageId: root.id, level: "comment" });
    expect(await isWithinShared(db, child.id, root.id)).toBe(true);
    expect(await isWithinShared(db, other.id, root.id)).toBe(false);
    await unpublishPage(db, owner.user, root.id);
    expect(await resolveShare(db, a.token)).toBeNull();
  });

  it("historial: instantáneas, restauración y respaldo del estado actual", async () => {
    const owner = await registerUser(db, { email: "v@nodara.test", name: "V", password: "contraseña-segura" });
    const p = await createPage(db, { title: "Doc", workspaceId: owner.workspace.id, creatorId: owner.user.id });
    const doc = (t: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: t }] }] });
    await updatePage(db, p.id, { content: doc("uno") });
    expect(await maybeSnapshot(db, p.id, owner.user.id)).toBe(true);
    expect(await maybeSnapshot(db, p.id, owner.user.id)).toBe(false); // sin cambios
    await updatePage(db, p.id, { content: doc("dos"), title: "Doc 2" });
    expect(await maybeSnapshot(db, p.id, owner.user.id)).toBe(true);
    const versions = await listVersions(db, owner.user, p.id);
    expect(versions).toHaveLength(2);
    const first = versions[1];
    await updatePage(db, p.id, { content: doc("tres") }); // cambio aún sin guardar en el historial
    await restoreVersion(db, owner.user, p.id, first.id);
    const list = await listVersions(db, owner.user, p.id);
    expect(list).toHaveLength(3); // el estado previo a restaurar («tres») se conservó
    const [row] = (await db.query.pages.findMany({ where: (t, { eq }) => eq(t.id, p.id) }));
    expect(row.title).toBe("Doc");
    expect(row.contentText).toBe("uno");
  });
});
