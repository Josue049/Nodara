"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/strings";
import { PageIcon } from "./page-icon";
import { useWorkspace } from "./workspace-provider";

type Result = { id: string; title: string; icon: string | null; snippet: string; path: string[] };

/** Diálogo de búsqueda (Ctrl+K): títulos y contenido, o solo títulos. */
export function SearchDialog() {
  const { searchOpen, setSearchOpen } = useWorkspace();
  if (!searchOpen) return null;
  return <SearchBody onClose={() => setSearchOpen(false)} />;
}

function SearchBody({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [titlesOnly, setTitlesOnly] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, []);

  useEffect(() => {
    const ctl = new AbortController();
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}${titlesOnly ? "&titlesOnly=1" : ""}`, {
          signal: ctl.signal,
        });
        if (res.ok) {
          setResults(await res.json());
          setActive(0);
        }
      } catch {}
    }, 120);
    return () => {
      clearTimeout(id);
      ctl.abort();
    };
  }, [query, titlesOnly]);

  const open = (r: Result | undefined) => {
    if (!r) return;
    onClose();
    router.push(`/${r.id}`);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/20 pt-[66px]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label={t.search}
        data-testid="search-dialog"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          else if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") open(results[active]);
        }}
        className="flex max-h-[700px] w-[min(720px,calc(100vw-32px))] flex-col overflow-hidden rounded-[20px] bg-[var(--popover)] shadow-[var(--shadow-pop)]"
      >
        <div className="flex items-center gap-3 px-5 pt-4 pb-2">
          <Search size={20} className="text-ink-3" />
          <input
            ref={input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            aria-label={t.search}
            className="flex-1 bg-transparent text-[18px] outline-none placeholder:text-ink-3"
          />
        </div>
        <div className="flex items-center gap-2 px-5 pb-2 text-[14px]">
          <button
            onClick={() => setTitlesOnly((v) => !v)}
            aria-pressed={titlesOnly}
            className={`rounded-md border px-2 py-0.5 ${titlesOnly ? "border-accent text-accent" : "border-line text-ink-2"} hover:bg-hover`}
          >
            {t.titlesOnly}
          </button>
        </div>
        <ul role="listbox" className="nd-scroll min-h-[120px] overflow-y-auto border-t border-line p-2">
          {results.length === 0 && <li className="px-3 py-6 text-center text-ink-3">{t.noResults}</li>}
          {results.map((r, i) => (
            <li key={r.id} role="option" aria-selected={i === active}>
              <button
                onMouseMove={() => setActive(i)}
                onClick={() => open(r)}
                data-testid="search-result"
                className={`flex w-full items-center gap-3 rounded-md px-3 py-1.5 text-left ${i === active ? "bg-hover" : ""}`}
              >
                <PageIcon icon={r.icon} size={20} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px]">{r.title || t.untitled}</span>
                  {r.snippet && <span className="block truncate text-[13px] text-ink-3">{r.snippet}</span>}
                </span>
                {r.path.length > 0 && <span className="max-w-[40%] truncate text-[12px] text-ink-3">{r.path.join(" / ")}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
