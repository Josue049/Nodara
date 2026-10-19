"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Modal } from "./modal";
import { useWorkspace } from "./workspace-provider";

/** Importa Markdown/texto/JSON de Nodara (como página) o CSV (como base de datos). */
export function ImportDialog({ onClose, parentId = null }: { onClose: () => void; parentId?: string | null }) {
  const router = useRouter();
  const { refreshPages } = useWorkspace();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const send = async (file: File) => {
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      if (parentId) form.append("parentId", parentId);
      const res = await fetch("/api/import", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "No se pudo importar");
      await refreshPages();
      onClose();
      router.push(`/${(body as { id: string }).id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo importar");
      setBusy(false);
    }
  };

  return (
    <Modal label="Importar" testId="import-dialog" onClose={onClose} width={480}>
      <h2 className="mb-1 text-[18px] font-semibold">Importar</h2>
      <p className="mb-3 text-ink-2">Trae contenido que ya tienes. Se crea una página nueva; nada existente se modifica.</p>
      <ul className="mb-4 list-disc pl-5 text-ink-2">
        <li>
          <b>Markdown o texto</b> (.md, .txt): una página con su formato.
        </li>
        <li>
          <b>JSON de Nodara</b> (.json): una página exportada desde Nodara.
        </li>
        <li>
          <b>CSV</b> (.csv): una base de datos; la primera fila son los nombres de columna.
        </li>
      </ul>
      <input
        ref={input}
        type="file"
        hidden
        data-testid="import-file"
        accept=".md,.markdown,.txt,.json,.csv,text/markdown,text/plain,application/json,text/csv"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void send(f);
        }}
      />
      <button type="button" disabled={busy} onClick={() => input.current?.click()} className="flex h-9 items-center gap-2 rounded-md bg-accent px-4 text-white disabled:opacity-60">
        <Upload size={16} /> {busy ? "Importando…" : "Elegir archivo"}
      </button>
      <p className="mt-2 text-[13px] text-ink-3">Tamaño máximo: 5 MB.</p>
      {error && (
        <p role="alert" className="mt-2 text-danger">
          {error}
        </p>
      )}
    </Modal>
  );
}
