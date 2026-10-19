"use client";

import { History, X } from "lucide-react";
import { useEffect, useState } from "react";
import { call } from "./database/api";
import { hardNavigate } from "./auth-provider";

type Version = { id: string; title: string; createdAt: string; authorName: string | null };

function textOf(node: unknown): string {
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const { text, content, type } = n as { text?: string; content?: unknown[]; type?: string };
    if (typeof text === "string") out.push(text);
    if (Array.isArray(content)) {
      content.forEach(walk);
      if (type && type !== "doc" && type !== "text") out.push("\n");
    }
  };
  walk(node);
  return out.join("").trim();
}

const fmt = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" });

/** Historial de versiones: lista de instantáneas, vista previa en texto y restauración. */
export function VersionHistory({ pageId, canRestore, onClose }: { pageId: string; canRestore: boolean; onClose: () => void }) {
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ title: string; text: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    call<Version[]>(`/api/pages/${pageId}/versions`).then((v) => alive && setVersions(v)).catch((e) => alive && setError(String(e.message ?? e)));
    return () => {
      alive = false;
    };
  }, [pageId]);

  const open = async (id: string) => {
    setSelected(id);
    const v = await call<{ title: string; content: unknown }>(`/api/pages/${pageId}/versions/${id}`);
    setPreview({ title: v.title, text: textOf(v.content) });
  };

  return (
    <aside role="dialog" aria-label="Historial de versiones" data-testid="version-history" className="fixed bottom-0 right-0 top-[var(--topbar-h)] z-50 flex w-[340px] flex-col border-l border-line bg-[var(--popover)] shadow-[var(--shadow-pop)]">
      <header className="flex items-center gap-2 border-b border-line px-3 py-2">
        <History size={16} />
        <h2 className="flex-1 font-medium">Historial de versiones</h2>
        <button type="button" aria-label="Cerrar" onClick={onClose} className="rounded p-1 hover:bg-hover">
          <X size={16} />
        </button>
      </header>
      <div className="nd-scroll flex-1 overflow-y-auto">
        {error && <p role="alert" className="p-3 text-danger">{error}</p>}
        {versions?.length === 0 && <p className="p-3 text-ink-3">Aún no hay versiones. Se guardan automáticamente mientras editas.</p>}
        <ul>
          {versions?.map((v) => (
            <li key={v.id}>
              <button type="button" data-testid="version-item" onClick={() => void open(v.id)} className={`flex w-full flex-col px-3 py-2 text-left hover:bg-hover ${selected === v.id ? "bg-hover" : ""}`}>
                <span className="text-[14px]">{fmt.format(new Date(v.createdAt))}</span>
                <span className="truncate text-[12px] text-ink-3">
                  {v.authorName ?? "—"} · {v.title || "Sin título"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {preview && (
        <div className="border-t border-line p-3">
          <p className="mb-1 font-medium">{preview.title || "Sin título"}</p>
          <pre className="nd-scroll mb-2 max-h-[160px] overflow-y-auto whitespace-pre-wrap text-[13px] text-ink-2" data-testid="version-preview">
            {preview.text || "(sin contenido)"}
          </pre>
          {canRestore && (
            <button
              type="button"
              data-testid="restore-version"
              onClick={async () => {
                await call(`/api/pages/${pageId}/versions/${selected}/restore`, "POST");
                hardNavigate(`/${pageId}`);
              }}
              className="h-8 w-full rounded-md bg-accent text-white"
            >
              Restaurar esta versión
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
