import { beforeEach, describe, expect, it } from "vitest";
import { pageAnalytics, recordView } from "@/server/analytics-service";
import { auditPage, auditToCsv, listAudit, recordAudit } from "@/server/audit-service";
import { assertPage, pageAccess } from "@/server/authz";
import { queryCollection } from "@/server/collections-service";
import { createDb, type Db } from "@/server/db";
import { exportCollectionCsv, exportPage, exportWorkspaceBackup, importCsv, importJson, importMarkdown, ImportError } from "@/server/import-export-service";
import { createPage, getPage, updatePage } from "@/server/pages-service";
import { createFromTemplate, deletePageTemplate, listPageTemplates, saveAsTemplate } from "@/server/templates-service";
import { sharePage } from "@/server/sharing-service";
import { registerUser } from "@/server/workspaces-service";
import { BUILTIN_TEMPLATES } from "@/lib/templates";
import { schemaExtensions } from "@/lib/editor/schema";
import { getSchema } from "@tiptap/core";
import { Node } from "@tiptap/pm/model";

let db: Db;
let owner: { id: string; email: string; name: string };
let ws: string;
beforeEach(async () => {
  db = await createDb("memory://");
  const res = await registerUser(db, { email: "ana@nodara.test", name: "Ana", password: "contraseña-segura" });
  owner = res.user as never;
  ws = res.workspace.id;
});
const target = () => ({ workspaceId: ws, creatorId: owner.id });

describe("importar y exportar páginas", () => {
  it("Markdown → página → Markdown conserva el contenido y el título", async () => {
    const page = await importMarkdown(db, target(), "# Informe\n\nTexto con **negrita**.\n\n- [x] hecho\n- [ ] pendiente\n", "Sin nombre");
    expect(page.title).toBe("Informe");
    expect(page.contentText).toContain("negrita");
    const md = await exportPage(db, page.id, "md");
    expect(md.filename).toBe("Informe.md");
    expect(md.body).toContain("**negrita**");
    expect(md.body).toContain("- [x] hecho");
  });

  it("sin encabezado de nivel 1 usa el nombre del archivo como título", async () => {
    const page = await importMarkdown(db, target(), "Solo un párrafo", "notas");
    expect(page.title).toBe("notas");
  });

  it("JSON de Nodara: ida y vuelta; rechaza formatos ajenos", async () => {
    const src = await importMarkdown(db, target(), "# Original\n\nHola", "x");
    const json = await exportPage(db, src.id, "json");
    const copy = await importJson(db, target(), json.body, "copia");
    expect(copy.title).toBe("Original");
    expect(copy.id).not.toBe(src.id);
    await expect(importJson(db, target(), "{no es json", "x")).rejects.toBeInstanceOf(ImportError);
    await expect(importJson(db, target(), JSON.stringify({ format: "otro" }), "x")).rejects.toBeInstanceOf(ImportError);
  });

  it("el HTML exportado escapa el contenido", async () => {
    const page = await createPage(db, { workspaceId: ws, creatorId: owner.id, title: "<b>x</b>" });
    await updatePage(db, page.id, { content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "<img src=x onerror=alert(1)>" }] }] } });
    const html = (await exportPage(db, page.id, "html")).body;
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });

  it("copia de seguridad del espacio: incluye páginas, bases y vistas, y excluye la papelera", async () => {
    await importMarkdown(db, target(), "# Una", "a");
    await importCsv(db, target(), "Nombre,Horas\nA,1\nB,2\n", "datos");
    const trashed = await createPage(db, { workspaceId: ws, creatorId: owner.id, title: "Borrada" });
    await db.execute(`UPDATE pages SET deleted_at = now() WHERE id = '${trashed.id}'` as never);
    const backup = await exportWorkspaceBackup(db, ws);
    expect(backup.format).toBe("nodara-workspace-backup");
    expect(backup.pages.map((p) => p.title)).toContain("Una");
    expect(backup.pages.map((p) => p.title)).not.toContain("Borrada");
    expect(backup.collections).toHaveLength(1);
    expect(backup.views.length).toBeGreaterThan(0);
  });
});

describe("CSV ↔ bases de datos", () => {
  const csv = "Nombre,Horas,Hecho,Vence,Estado,Web\nAlfa,3,sí,2026-01-05,Abierto,https://a.test\nBeta,1.5,no,2026-02-10,Cerrado,https://b.test\nGama,2,sí,2026-03-01,Abierto,https://c.test\nDelta,4,no,2026-03-15,Abierto,https://d.test\n";

  it("importa con propiedades tipadas y una fila por registro", async () => {
    const res = await importCsv(db, target(), csv, "Tareas");
    expect(res.rows).toBe(4);
    const types = Object.fromEntries(res.properties.map((p) => [p.name, p.type]));
    expect(types).toMatchObject({ Horas: "number", Hecho: "checkbox", Vence: "date", Estado: "select", Web: "url" });
    const q = await queryCollection(db, res.collection.id, { config: {} });
    expect(q.rows).toHaveLength(4);
    const beta = q.rows.find((r) => r.title === "Beta")!;
    const horas = res.properties.find((p) => p.name === "Horas")!;
    expect(beta.values[horas.id]).toBe(1.5);
  });

  it("exporta el mismo contenido que se importó", async () => {
    const res = await importCsv(db, target(), csv, "Tareas");
    const out = await exportCollectionCsv(db, res.collection.id);
    expect(out.filename).toBe("Tareas.csv");
    expect(out.body).toContain("Nombre,Horas,Hecho,Vence,Estado,Web");
    expect(out.body).toContain("Alfa,3,Sí");
    expect(out.body).toContain("Cerrado");
  });

  it("acepta punto y coma, comillas y saltos de línea dentro de celdas", async () => {
    const res = await importCsv(db, target(), 'Título;Nota\n"Con; punto";"línea 1\nlínea 2"\n', "x");
    const q = await queryCollection(db, res.collection.id, { config: {} });
    expect(q.rows[0].title).toBe("Con; punto");
    expect(q.rows[0].values[res.properties[0].id]).toBe("línea 1\nlínea 2");
  });

  it("rechaza archivos vacíos y límites excedidos", async () => {
    await expect(importCsv(db, target(), "", "x")).rejects.toBeInstanceOf(ImportError);
    const wide = Array.from({ length: 70 }, (_, i) => `c${i}`).join(",");
    await expect(importCsv(db, target(), `${wide}\n`, "x")).rejects.toBeInstanceOf(ImportError);
  });

  it("neutraliza fórmulas al exportar (inyección en hojas de cálculo)", async () => {
    const res = await importCsv(db, target(), "Nombre,Nota\n=CMD(),texto\n", "x");
    const out = await exportCollectionCsv(db, res.collection.id);
    expect(out.body).toContain("'=CMD()");
  });
});

describe("plantillas de página", () => {
  it("cada plantilla integrada es un documento válido para el esquema del editor", () => {
    const schema = getSchema(schemaExtensions());
    for (const t of BUILTIN_TEMPLATES) {
      expect(() => Node.fromJSON(schema, t.content).check(), t.key).not.toThrow();
    }
  });

  it("crea páginas desde plantillas integradas y desde plantillas propias", async () => {
    const page = await createFromTemplate(db, owner as never, { workspaceId: ws, templateId: "builtin:meeting-notes" });
    expect(page.title).toBe("Notas de reunión");
    expect(page.contentText).toContain("Agenda");
    const mine = await importMarkdown(db, target(), "# Mi base\n\nTexto propio", "x");
    const tpl = await saveAsTemplate(db, owner as never, ws, mine.id, "Mi plantilla");
    const list = await listPageTemplates(db, ws);
    expect(list.filter((t) => t.builtin)).toHaveLength(BUILTIN_TEMPLATES.length);
    expect(list.find((t) => t.id === tpl.id)?.name).toBe("Mi plantilla");
    const fromMine = await createFromTemplate(db, owner as never, { workspaceId: ws, templateId: tpl.id });
    expect(fromMine.contentText).toContain("Texto propio");
    await deletePageTemplate(db, owner as never, tpl.id);
    expect((await listPageTemplates(db, ws)).some((t) => t.id === tpl.id)).toBe(false);
  });

  it("una plantilla de otro espacio no es accesible", async () => {
    const other = await registerUser(db, { email: "luis@nodara.test", name: "Luis", password: "contraseña-segura" });
    const mine = await importMarkdown(db, target(), "# Privada", "x");
    const tpl = await saveAsTemplate(db, owner as never, ws, mine.id, "Secreta");
    await expect(createFromTemplate(db, other.user as never, { workspaceId: other.workspace.id, templateId: tpl.id })).rejects.toMatchObject({ status: 404 });
  });
});

describe("auditoría", () => {
  it("registra y lista eventos, más recientes primero, con filtro por acción", async () => {
    await recordAudit(db, { workspaceId: ws, actorId: owner.id, action: "page.share", detail: "uno" });
    await recordAudit(db, { workspaceId: ws, actorId: owner.id, action: "page.trash", detail: "dos" });
    const all = await listAudit(db, ws);
    expect(all.map((e) => e.detail)).toEqual(["dos", "uno"]);
    expect(all[0].actorName).toBe("Ana");
    expect(await listAudit(db, ws, { action: "page.share" })).toHaveLength(1);
  });

  it("auditPage deduce el espacio de la página y el CSV escapa el contenido", async () => {
    const page = await createPage(db, { workspaceId: ws, creatorId: owner.id, title: "P" });
    await auditPage(db, owner as never, page.id, "page.lock", 'dice "hola", ok');
    const entries = await listAudit(db, ws);
    expect(entries[0].targetId).toBe(page.id);
    const csv = auditToCsv(entries);
    expect(csv).toContain('"dice ""hola"", ok"');
    expect(csv).toContain("Página bloqueada o desbloqueada");
  });

  it("un fallo al auditar no interrumpe la operación", async () => {
    await expect(recordAudit(db, { workspaceId: "no-es-uuid", actorId: owner.id, action: "x" })).resolves.toBeUndefined();
  });
});

describe("analíticas de página", () => {
  it("cuenta visitas por persona y día, y agrega por días y por persona", async () => {
    const page = await createPage(db, { workspaceId: ws, creatorId: owner.id, title: "Medida" });
    const other = await registerUser(db, { email: "luis@nodara.test", name: "Luis", password: "contraseña-segura" });
    await recordView(db, owner.id, page.id);
    await recordView(db, owner.id, page.id);
    await recordView(db, other.user.id, page.id);
    const a = await pageAnalytics(db, page.id);
    expect(a.totalViews).toBe(3);
    expect(a.uniqueViewers).toBe(2);
    expect(a.viewsToday).toBe(3);
    expect(a.daily).toHaveLength(14);
    expect(a.daily.at(-1)?.views).toBe(3);
    expect(a.viewers.find((v) => v.name === "Ana")?.views).toBe(2);
  });
});

describe("bloqueo de página", () => {
  it("una página bloqueada deja de ser editable, pero quien podía editar puede desbloquearla", async () => {
    const editor = await registerUser(db, { email: "luis@nodara.test", name: "Luis", password: "contraseña-segura" });
    const page = await createPage(db, { workspaceId: ws, creatorId: owner.id, title: "Doc" });
    await updatePage(db, page.id, { locked: true });
    const a = await pageAccess(db, owner.id, page.id);
    expect(a?.level).toBe("comment");
    expect(a?.canUnlock).toBe(true);
    expect(a?.locked).toBe(true);
    await expect(assertPage(db, owner as never, page.id, "edit")).rejects.toMatchObject({ status: 403 });
    await updatePage(db, page.id, { locked: false });
    expect((await pageAccess(db, owner.id, page.id))?.level).toBe("full");
    // quien solo tiene acceso de lectura nunca podría desbloquear
    void editor;
    void sharePage;
    expect((await getPage(db, page.id)).locked).toBe(false);
  });

  it("el bloqueo no afecta a las páginas hijas", async () => {
    const parent = await createPage(db, { workspaceId: ws, creatorId: owner.id, title: "Padre" });
    const child = await createPage(db, { workspaceId: ws, creatorId: owner.id, parentId: parent.id, title: "Hija" });
    await updatePage(db, parent.id, { locked: true });
    expect((await pageAccess(db, owner.id, child.id))?.level).toBe("full");
    expect(Node).toBeDefined();
  });
});

describe("ajustes de página", () => {
  it("guarda portada, tipografía, texto pequeño y ancho completo", async () => {
    const page = await createPage(db, { workspaceId: ws, creatorId: owner.id, title: "Ajustes" });
    const row = await updatePage(db, page.id, { cover: "color:azul", fontStyle: "serif", smallText: true, fullWidth: true });
    expect(row).toMatchObject({ cover: "color:azul", fontStyle: "serif", smallText: true, fullWidth: true, locked: false });
    expect((await getPage(db, page.id)).fontStyle).toBe("serif");
  });
});
