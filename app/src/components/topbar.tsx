"use client";

import { Star } from "lucide-react";
import Link from "next/link";
import { t } from "@/lib/strings";
import { pathTo } from "@/lib/tree";
import { PageIcon } from "./page-icon";
import { useWorkspace } from "./workspace-provider";

export type SaveState = "idle" | "saving" | "saved" | "error";

export function Topbar({ pageId, saveState, record }: { pageId: string; saveState: SaveState; record?: { id: string; title: string; icon: string | null; parentId: string | null } }) {
  const { pages, toggleFavorite } = useWorkspace();
  // Los registros de bases de datos no están en el árbol: la ruta es la de su base más el propio registro.
  const trail = record
    ? [...(record.parentId ? pathTo(pages, record.parentId) : []), { id: record.id, title: record.title, icon: record.icon, parentId: record.parentId, position: 0, isFavorite: false, kind: "page" }]
    : pathTo(pages, pageId);
  const current = record ? undefined : trail.at(-1);
  const label = { idle: "", saving: t.saving, saved: t.saved, error: t.saveError }[saveState];
  return (
    <header className="flex h-[var(--topbar-h)] shrink-0 items-center gap-2 px-3 text-[14px]">
      <nav aria-label="Ruta" className="flex min-w-0 items-center gap-1 text-ink-2">
        {trail.map((p, i) => (
          <span key={p.id} className="flex min-w-0 items-center gap-1">
            {i > 0 && <span className="text-ink-3">/</span>}
            <Link href={`/${p.id}`} className="flex min-w-0 items-center gap-1 rounded px-1.5 py-0.5 hover:bg-hover">
              <PageIcon icon={p.icon} size={16} kind={p.kind} />
              <span className="truncate">{p.title || t.untitled}</span>
            </Link>
          </span>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <span role="status" aria-live="polite" className="text-[12px] text-ink-3" data-testid="save-status">
          {label}
        </span>
        {current && (
          <button
            aria-label={current.isFavorite ? t.removeFavorite : t.addFavorite}
            aria-pressed={current.isFavorite}
            title={current.isFavorite ? t.removeFavorite : t.addFavorite}
            onClick={() => void toggleFavorite(current.id)}
            className="flex size-7 items-center justify-center rounded hover:bg-hover"
          >
            <Star size={16} className={current.isFavorite ? "fill-[#f5c542] text-[#f5c542]" : "text-ink-2"} />
          </button>
        )}
      </div>
    </header>
  );
}
