import { NextResponse } from "next/server";
import { saveUpload } from "@/server/files";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
    return NextResponse.json(await saveUpload(file), { status: 201 });
  } catch (e) {
    if (e instanceof RangeError) return NextResponse.json({ error: e.message }, { status: 413 });
    console.error(e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
