"use client";

import { Search } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { splitMarks } from "@/lib/search";
import { t } from "@/lib/strings";
import { PageIcon } from "./page-icon";
import { useWorkspace } from "./workspace-provider";

type Result = { id: string; title: string; titleMarked: string; icon: string | null; snippet: string; path: string[]; updatedAt: string; kind: string };

const selectCls = "h-7 rounded-md border border-line bg-transparent px-1.5 text-[13px] text-ink-2 outline-none hover:bg-hover focus:border-accent";
const dateFmt = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" });

/** Texto con las coincidencias resaltadas (sin HTML: se pintan como <mark>). */
function Marked({ text }: { text: string }) {
  return (
    <>
      {splitMarks(text).map((part, i) =>
        part.hit ? (
          <mark key={i} className="rounded-[3px] bg-[rgba(255,212,0,0.35)] px-0 text-inherit">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

/** Diálogo de búsqueda (Ctrl+K): títulos y contenido, o solo títulos. */
export function SearchDialog() {
  const { searchOpen, setSearchOpen } = useWorkspace();
  if (!searchOpen) return null;
  return <SearchBody onClose={() => setSearchOpen(false)} />;
}

function SearchBody({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const params = useParams<{ pageId?: string }>();
  const [titlesOnly, setTitlesOnly] = useState(false);
  const [edited, setEdited] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [kind, setKind] = useState("");
  const [sort, setSort] = useState("relevance");
  const [insideCurrent, setInsideCurrent] = useState(false);
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
        const qs = new URLSearchParams({ q: query });
        if (titlesOnly) qs.set("titlesOnly", "1");
        if (edited) qs.set("edited", edited);
        if (createdBy) qs.set("createdBy", createdBy);
        if (kind) qs.set("kind", kind);
        if (sort !== "relevance") qs.set("sort", sort);
        if (insideCurrent && params.pageId) qs.set("inside", params.pageId);
        const res = await fetch(`/api/search?${qs}`, { signal: ctl.signal });
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
  }, [query, titlesOnly, edited, createdBy, kind, sort, insideCurrent, params.pageId]);

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
        <div className="flex flex-wrap items-center gap-2 px-5 pb-2 text-[14px]" data-testid="search-filters">
          <button
            onClick={() => setTitlesOnly((v) => !v)}
            aria-pressed={titlesOnly}
            className={`rounded-md border px-2 py-0.5 ${titlesOnly ? "border-accent text-accent" : "border-line text-ink-2"} hover:bg-hover`}
          >
            {t.titlesOnly}
          </button>
          {params.pageId && (
            <button
              onClick={() => setInsideCurrent((v) => !v)}
              aria-pressed={insideCurrent}
              data-testid="filter-inside"
              className={`rounded-md border px-2 py-0.5 ${insideCurrent ? "border-accent text-accent" : "border-line text-ink-2"} hover:bg-hover`}
            >
              En esta página
            </button>
          )}
          <select aria-label="Editado" value={edited} onChange={(e) => setEdited(e.target.value)} className={selectCls}>
            <option value="">Cualquier fecha</option>
            <option value="day">Último día</option>
            <option value="week">Última semana</option>
            <option value="month">Último mes</option>
            <option value="year">Último año</option>
          </select>
          <select aria-label="Creado por" value={createdBy} onChange={(e) => setCreatedBy(e.target.value)} className={selectCls}>
            <option value="">Cualquier autor</option>
            <option value="me">Creadas por mí</option>
          </select>
          <select aria-label="Tipo" value={kind} onChange={(e) => setKind(e.target.value)} className={selectCls}>
            <option value="">Todo</option>
            <option value="page">Páginas</option>
            <option value="database">Bases de datos</option>
            <option value="record">Registros</option>
          </select>
          <select aria-label="Ordenar por" value={sort} onChange={(e) => setSort(e.target.value)} className={selectCls}>
            <option value="relevance">Relevancia</option>
            <option value="edited">Última edición</option>
          </select>
        </div>
        {results.length === 0 && <p className="min-h-[120px] border-t border-line px-3 py-6 text-center text-ink-3">{t.noResults}</p>}
        <ul role="listbox" aria-label="Resultados" hidden={results.length === 0} className="nd-scroll min-h-[120px] overflow-y-auto border-t border-line p-2">
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
                  <span className="block truncate text-[15px]">{r.title ? <Marked text={r.titleMarked} /> : t.untitled}</span>
                  {r.snippet && (
                    <span className="block truncate text-[13px] text-ink-3" data-testid="search-snippet">
                      <Marked text={r.snippet} />
                    </span>
                  )}
                </span>
                <span className="max-w-[40%] shrink-0 truncate text-right text-[12px] text-ink-3">
                  {r.path.length > 0 && <span className="block truncate">{r.path.join(" / ")}</span>}
                  <span className="block">{dateFmt.format(new Date(r.updatedAt))}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
