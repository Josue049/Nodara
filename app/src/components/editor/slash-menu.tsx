"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/strings";
import type { SlashBridge, SlashState } from "./slash-extension";
import { filteredSub, SECTIONS, type SlashContext, type SlashEntry, type SlashIcon } from "./slash-items";

/** Crea el puente y el estado que consume <SlashMenu>. */
export function useSlashBridge() {
  const [state, setState] = useState<SlashState>(null);
  const [index, setIndex] = useState(0);
  const [bridge] = useState<SlashBridge & { setIndex: (i: number) => void; setContext: (c: SlashContext | null) => void }>(() => {
    const ref = { state: null as SlashState, index: 0, context: null as SlashContext | null };
    return {
      context: () => ref.context,
      setContext(c) {
        ref.context = c;
      },
      update(s) {
        if (s?.query !== ref.state?.query || s?.entries.length !== ref.state?.entries.length) ref.index = 0;
        ref.state = s;
        setState(s);
        setIndex(ref.index);
      },
      setIndex(i) {
        ref.index = i;
        setIndex(i);
      },
      keyDown(e) {
        const s = ref.state;
        if (!s || s.entries.length === 0) return false;
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          const d = e.key === "ArrowDown" ? 1 : -1;
          ref.index = (ref.index + d + s.entries.length) % s.entries.length;
          setIndex(ref.index);
          return true;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          s.select(s.entries[ref.index]);
          return true;
        }
        return false;
      },
    };
  });
  return { bridge, state, index };
}

// Medidas del menú: ancho 324, lista 273 + pie 42.
const WIDTH = 324;
const HEIGHT = 315;
const GAP = 12;

export function MenuIcon({ icon }: { icon: SlashIcon }) {
  if ("kind" in icon && "swatch" in icon) {
    return icon.kind === "text" ? (
      <span className="nd-menu-swatch" style={{ color: icon.swatch ?? undefined }} aria-hidden>
        A
      </span>
    ) : (
      <span className="nd-menu-swatch" style={{ background: icon.swatch ?? undefined }} aria-hidden />
    );
  }
  const Icon = icon;
  return <Icon size={20} strokeWidth={1.5} aria-hidden />;
}

export function SlashMenu({ state, index, onHover }: { state: SlashState; index: number; onHover: (i: number) => void }) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current?.querySelector("[data-slash-active=true]")?.scrollIntoView({ block: "nearest" });
  }, [index]);

  // Sin coincidencias, el menú se cierra; el texto escrito se queda.
  if (!state || !state.rect || state.entries.length === 0) return null;
  const r = state.rect;
  const below = r.bottom + GAP + HEIGHT <= window.innerHeight || r.top - GAP - HEIGHT < 0;
  const pos = { top: below ? r.bottom + GAP : r.top - GAP - HEIGHT, left: Math.max(8, Math.min(r.left - 11, window.innerWidth - WIDTH - 8)) };
  const filtered = state.query.trim().length > 0;
  const groups: { section: string; entries: { entry: SlashEntry; i: number }[] }[] = [];
  state.entries.forEach((entry, i) => {
    const section = filtered ? "filtered" : entry.section;
    const last = groups.at(-1);
    if (last?.section === section) last.entries.push({ entry, i });
    else groups.push({ section, entries: [{ entry, i }] });
  });

  return (
    <div
      className="nd-menu nd-fade fixed z-50 flex flex-col"
      style={{ top: pos.top, left: pos.left, width: WIDTH, maxHeight: HEIGHT }}
      data-testid="slash-menu"
      onMouseDown={(e) => e.preventDefault()}
    >
      <div ref={list} role="listbox" aria-label={t.insertBlock} className="nd-scroll min-h-0 flex-1 overflow-y-auto pb-1">
        {groups.map((g, gi) => (
          <div key={g.section} role="group" aria-label={g.section === "filtered" ? "Resultados filtrados" : SECTIONS[g.section as keyof typeof SECTIONS]}>
            {gi > 0 && <div className="nd-menu-sep" role="separator" />}
            <div className="nd-menu-header" data-testid="slash-section">
              {g.section === "filtered" ? "Resultados filtrados" : SECTIONS[g.section as keyof typeof SECTIONS]}
            </div>
            {g.entries.map(({ entry, i }) => {
              const sub = filtered ? filteredSub(entry.item) : null;
              return (
                <button
                  key={entry.key}
                  type="button"
                  role="option"
                  aria-selected={i === index}
                  aria-label={sub ? `${entry.item.title}, ${sub}` : entry.item.title}
                  data-slash-active={i === index}
                  data-slash-id={entry.item.id}
                  onMouseMove={() => i !== index && onHover(i)}
                  onClick={() => state.select(entry)}
                  className="nd-menu-item"
                >
                  <span className="nd-menu-icon">
                    <MenuIcon icon={entry.item.icon} />
                  </span>
                  <span className="truncate">{entry.item.title}</span>
                  {sub && <span className="nd-menu-sub truncate">· {sub}</span>}
                  {entry.item.hint && <span className="nd-menu-hint">{entry.item.hint}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <button type="button" className="nd-menu-footer" onClick={state.close} data-testid="slash-close">
        <span>Cerrar menú</span>
        <span className="nd-menu-hint">esc</span>
      </button>
    </div>
  );
}
