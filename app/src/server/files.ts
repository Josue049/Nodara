import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import type { Db } from "./db";
import { files as filesTable } from "./schema";

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export function uploadDir(): string {
  return process.env.NODARA_UPLOAD_DIR ?? path.resolve(process.cwd(), "..", ".data", "uploads");
}

const INLINE_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  // Vídeo y audio: se reproducen en los bloques de medios (siguen con nosniff).
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
};

const safeName = (name: string) =>
  name
    .normalize("NFC")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 150) || "archivo";

/** Guarda un archivo subido. El id es un UUID; el nombre original se conserva solo para mostrarlo. */
export async function saveUpload(db: Db, file: File, owner: { workspaceId: string; userId: string }): Promise<{ name: string; url: string }> {
  if (file.size > MAX_UPLOAD_BYTES) throw new RangeError("El archivo supera el límite de 20 MB");
  const id = randomUUID();
  const name = safeName(file.name);
  await mkdir(uploadDir(), { recursive: true });
  await writeFile(path.join(uploadDir(), `${id}__${name}`), Buffer.from(await file.arrayBuffer()));
  await db.insert(filesTable).values({ id, workspaceId: owner.workspaceId, name, size: file.size, createdBy: owner.userId });
  return { name, url: `/api/files/${id}` };
}

export async function readUpload(id: string): Promise<{ data: Buffer; name: string; contentType: string; inline: boolean } | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const files = await readdir(uploadDir()).catch(() => [] as string[]);
  const found = files.find((f) => f.startsWith(`${id}__`));
  if (!found) return null;
  const name = found.slice(id.length + 2);
  const ext = path.extname(name).toLowerCase();
  const known = INLINE_TYPES[ext];
  return { data: await readFile(path.join(uploadDir(), found)), name, contentType: known ?? "application/octet-stream", inline: !!known };
}

/** Espacio de trabajo al que pertenece un archivo (para autorizar la descarga). */
export async function fileWorkspace(db: Db, id: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [f] = await db.select({ w: filesTable.workspaceId }).from(filesTable).where(eq(filesTable.id, id));
  return f?.w ?? null;
}
