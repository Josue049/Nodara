"use client";

import { useEffect, useState } from "react";
import { t } from "@/lib/strings";
import type { SlashBridge, SlashState } from "./slash-extension";

/** Crea el puente y el estado que consume <SlashMenu>. */
export function useSlashBridge() {
  const [state, setState] = useState<SlashState>(null);
  const [index, setIndex] = useState(0);
  const [bridge] = useState<SlashBridge>(() => {
    const ref = { state: null as SlashState, index: 0 };
    return {
      update(s) {
        if (s?.items.length !== ref.state?.items.length) ref.index = 0;
        ref.state = s;
        setState(s);
        setIndex(ref.index);
      },
      keyDown(e) {
        const s = ref.state;
        if (!s || s.items.length === 0) return false;
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          const d = e.key === "ArrowDown" ? 1 : -1;
          ref.index = (ref.index + d + s.items.length) % s.items.length;
          setIndex(ref.index);
          return true;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          s.select(s.items[ref.index]);
          return true;
        }
        return false;
      },
    };
  });
  return { bridge, state, index };
}

export function SlashMenu({ state, index }: { state: SlashState; index: number }) {
  useEffect(() => {
    document.querySelector("[data-slash-active=true]")?.scrollIntoView({ block: "nearest" });
  }, [index]);
  if (!state || !state.rect) return null;
  const { rect, items, select } = state;
  return (
    <div
      role="listbox"
      aria-label={t.insertBlock}
      data-testid="slash-menu"
      className="nd-scroll fixed z-50 max-h-[330px] w-[320px] overflow-y-auto rounded-md bg-[var(--popover)] p-1 text-sm shadow-[var(--shadow-pop)]"
      style={{ top: rect.bottom + 6, left: rect.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {items.length === 0 && <div className="px-3 py-2 text-ink-3">{t.noResults}</div>}
      {items.map((item, i) => (
        <button
          key={item.id}
          role="option"
          aria-selected={i === index}
          data-slash-active={i === index}
          onClick={() => select(item)}
          className={`flex w-full flex-col rounded px-2 py-1 text-left ${i === index ? "bg-hover" : ""}`}
        >
          <span className="text-[14px]">{item.title}</span>
          <span className="text-[12px] text-ink-3">{item.hint}</span>
        </button>
      ))}
    </div>
  );
}
