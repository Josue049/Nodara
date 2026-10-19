import { NextResponse } from "next/server";
import { readUpload } from "@/server/files";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const file = await readUpload((await ctx.params).id);
  if (!file) return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `${file.inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
