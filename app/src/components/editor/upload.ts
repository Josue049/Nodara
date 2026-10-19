/** Sube un archivo al espacio de trabajo actual (la cookie de espacio la resuelve el servidor). */
export async function uploadFile(file: File): Promise<{ name: string; url: string; size: number }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/files", { method: "POST", body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? "No se pudo subir el archivo");
  return { ...(body as { name: string; url: string }), size: file.size };
}

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
