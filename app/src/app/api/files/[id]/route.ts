import { NextResponse } from "next/server";
import { HttpError } from "@/server/auth";
import { memberRole } from "@/server/authz";
import { fileWorkspace, readUpload } from "@/server/files";
import { api } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = api(async (_req, p, user, db) => {
  const ws = await fileWorkspace(db, p.id);
  if (!ws || !(await memberRole(db, user.id, ws))) throw new HttpError(404, "Archivo no encontrado");
  const file = await readUpload(p.id);
  if (!file) throw new HttpError(404, "Archivo no encontrado");
  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `${file.inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
    },
  });
});
