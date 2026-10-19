"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { call } from "./database/api";
import { Modal } from "./modal";
import { PageIcon } from "./page-icon";
import { useWorkspace } from "./workspace-provider";

type Tpl = { id: string; name: string; description: string; icon: string | null; builtin: boolean };

/** Galería de plantillas de página: integradas y propias del espacio de trabajo. */
export function TemplatesDialog({ onClose, parentId = null }: { onClose: () => void; parentId?: string | null }) {
  const router = useRouter();
  const { refreshPages } = useWorkspace();
  const [items, setItems] = useState<Tpl[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    call<Tpl[]>("/api/page-templates").then((r) => alive && setItems(r)).catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const use = async (t: Tpl) => {
    setBusy(t.id);
    setError("");
    try {
      const page = await call<{ id: string }>("/api/page-templates/use", "POST", { templateId: t.id, parentId });
      await refreshPages();
      onClose();
      router.push(`/${page.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la página");
      setBusy(null);
    }
  };

  return (
    <Modal label="Plantillas" testId="templates-dialog" onClose={onClose} width={640}>
      <h2 className="mb-1 text-[18px] font-semibold">Plantillas</h2>
      <p className="mb-4 text-ink-2">Empieza con una estructura lista. Para crear la tuya, usa «Guardar como plantilla» en el menú de cualquier página.</p>
      {error && (
        <p role="alert" className="mb-2 text-danger">
          {error}
        </p>
      )}
      {!items ? (
        <p className="text-ink-3">Cargando…</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 max-[560px]:grid-cols-1">
          {items.map((t) => (
            <li key={t.id} className="group/t relative">
              <button
                type="button"
                data-testid="template-item"
                disabled={busy !== null}
                onClick={() => use(t)}
                className="flex h-full w-full items-start gap-3 rounded-lg border border-line p-3 text-left hover:bg-hover disabled:opacity-60"
              >
                <span className="text-[24px] leading-none">
                  <PageIcon icon={t.icon} size={24} />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">{t.name}</span>
                  <span className="block text-[13px] text-ink-3">{busy === t.id ? "Creando…" : t.description}</span>
                </span>
              </button>
              {!t.builtin && (
                <button
                  type="button"
                  aria-label={`Eliminar plantilla ${t.name}`}
                  onClick={async () => {
                    await call(`/api/page-templates/${t.id}`, "DELETE");
                    setItems((l) => (l ?? []).filter((x) => x.id !== t.id));
                  }}
                  className="absolute right-2 top-2 rounded p-1 text-ink-3 opacity-0 hover:bg-active group-hover/t:opacity-100 focus-visible:opacity-100"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
