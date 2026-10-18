"use client";

import { FolderInput, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { t } from "@/lib/strings";
import { childrenOf, pathTo } from "@/lib/tree";
import { PageIcon } from "./page-icon";
import { useWorkspace } from "./workspace-provider";

/** Diálogo «Mover a» (Ctrl+⇧+P): elige la nueva página padre o la raíz. */
export function MoveDialog() {
  const { moveTarget, setMoveTarget } = useWorkspace();
  if (!moveTarget) return null;
  return <MoveBody id={moveTarget} onClose={() => setMoveTarget(null)} />;
}

function MoveBody({ id, onClose }: { id: string; onClose: () => void }) {
  const { pages, movePage } = useWorkspace();
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  // No se puede mover una página dentro de sí misma ni de sus descendientes.
  const forbidden = useMemo(() => {
    const out = new Set<string>([id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const p of pages) {
        if (p.parentId && out.has(p.parentId) && !out.has(p.id)) {
          out.add(p.id);
          grew = true;
        }
      }
    }
    return out;
  }, [pages, id]);
  const q = query.trim().toLowerCase();
  const options = pages.filter((p) => !forbidden.has(p.id) && (!q || p.title.toLowerCase().includes(q)));

  const choose = async (parentId: string | null) => {
    onClose();
    await movePage(id, parentId, childrenOf(pages, parentId).filter((p) => p.id !== id).length);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/20 pt-[100px]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label={t.moveTo}
        data-testid="move-dialog"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        className="flex max-h-[480px] w-[min(420px,calc(100vw-32px))] flex-col overflow-hidden rounded-[14px] bg-[var(--popover)] shadow-[var(--shadow-pop)]"
      >
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <Search size={16} className="text-ink-3" />
          <input
            ref={input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.moveToPlaceholder}
            aria-label={t.moveToPlaceholder}
            className="flex-1 bg-transparent outline-none placeholder:text-ink-3"
          />
        </div>
        <ul className="nd-scroll overflow-y-auto p-1 text-[14px]">
          {!q && (
            <li>
              <button onClick={() => choose(null)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-hover">
                <FolderInput size={16} className="text-ink-2" />
                {t.pages}
              </button>
            </li>
          )}
          {options.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => choose(p.id)}
                data-testid="move-option"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-hover"
              >
                <PageIcon icon={p.icon} />
                <span className="truncate">{p.title || t.untitled}</span>
                <span className="ml-auto truncate text-[12px] text-ink-3">
                  {pathTo(pages, p.id).slice(0, -1).map((x) => x.title || t.untitled).join(" / ")}
                </span>
              </button>
            </li>
          ))}
          {options.length === 0 && q && <li className="px-3 py-4 text-center text-ink-3">{t.noResults}</li>}
        </ul>
      </div>
    </div>
  );
}
