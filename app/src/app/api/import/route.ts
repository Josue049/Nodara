import { z } from "zod";
import { HttpError } from "@/server/auth";
import { recordAudit } from "@/server/audit-service";
import { assertPage, memberRole } from "@/server/authz";
import { api, resolveWorkspace } from "@/server/http";
import { ImportError, importCsv, importJson, importMarkdown, MAX_IMPORT_BYTES } from "@/server/import-export-service";

export const dynamic = "force-dynamic";

/** Importa un archivo .md/.markdown/.txt (página), .json (exportación de Nodara) o .csv (base de datos). */
export const POST = api(async (req, _p, user, db) => {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) throw new HttpError(400, "Falta el archivo");
  if (file.size > MAX_IMPORT_BYTES) throw new HttpError(413, "El archivo supera el límite de 5 MB");
  const parentRaw = form?.get("parentId");
  const parentId = typeof parentRaw === "string" && parentRaw ? z.uuid().parse(parentRaw) : null;
  let workspaceId: string;
  if (parentId) workspaceId = (await assertPage(db, user, parentId, "edit")).workspaceId;
  else {
    workspaceId = await resolveWorkspace(db, user, req);
    if ((await memberRole(db, user.id, workspaceId)) === "guest") throw new HttpError(403, "Los invitados no pueden importar en la raíz");
  }
  const text = new TextDecoder("utf-8").decode(await file.arrayBuffer());
  const base = file.name.replace(/\.[^.]+$/, "") || "Importado";
  const ext = (/\.([^.]+)$/.exec(file.name)?.[1] ?? "").toLowerCase();
  const target = { workspaceId, parentId, creatorId: user.id };
  try {
    let result: { id: string; title: string; kind: string };
    if (["md", "markdown", "txt"].includes(ext)) {
      const page = await importMarkdown(db, target, text, base);
      result = { id: page.id, title: page.title, kind: "page" };
    } else if (ext === "json") {
      const page = await importJson(db, target, text, base);
      result = { id: page.id, title: page.title, kind: "page" };
    } else if (ext === "csv") {
      const res = await importCsv(db, target, text, base);
      result = { id: res.page.id, title: res.page.title, kind: "database" };
    } else throw new HttpError(400, "Formato no admitido. Usa .md, .txt, .json o .csv");
    await recordAudit(db, { workspaceId, actorId: user.id, action: "import", targetId: result.id, detail: file.name });
    return Response.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof ImportError) throw new HttpError(400, e.message);
    throw e;
  }
});
