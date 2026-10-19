"use client";

import type { Editor, Range } from "@tiptap/core";
import type { SuggestionKeyDownProps, SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import { useState } from "react";
import { Avatar } from "../settings-dialog";

export type MentionMember = { id: string; name: string; color: string };

type MentionAttrs = { id: string | null; label?: string | null };
type MenuState = { items: MentionMember[]; rect: DOMRect | null; select: (m: MentionMember) => void } | null;
type Bridge = { update: (s: MenuState) => void; keyDown: (e: KeyboardEvent) => boolean };

/** Estado del menú de menciones (@) alimentado por el plugin de sugerencias de TipTap. */
export function useMentionBridge() {
  const [state, setState] = useState<MenuState>(null);
  const [index, setIndex] = useState(0);
  const [bridge] = useState<Bridge>(() => {
    const ref = { state: null as MenuState, index: 0 };
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
          ref.index = (ref.index + (e.key === "ArrowDown" ? 1 : -1) + s.items.length) % s.items.length;
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

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Configuración de `@tiptap/extension-mention`: lista las personas del espacio filtrando por nombre. */
export function mentionSuggestion(members: MentionMember[], bridge: Bridge): Omit<SuggestionOptions<MentionMember, MentionAttrs>, "editor"> {
  const toState = (p: SuggestionProps<MentionMember, MentionAttrs>): MenuState => ({
    items: p.items,
    rect: p.clientRect?.() ?? null,
    select: (m) => p.command({ id: m.id, label: m.name }),
  });
  return {
    char: "@",
    allowSpaces: false,
    items: ({ query }) => members.filter((m) => fold(m.name).includes(fold(query))).slice(0, 8),
    command: ({ editor, range, props }: { editor: Editor; range: Range; props: MentionAttrs }) => {
      editor.chain().focus().insertContentAt(range, [{ type: "mention", attrs: props }, { type: "text", text: " " }]).run();
    },
    render: () => ({
      onStart: (p) => bridge.update(toState(p)),
      onUpdate: (p) => bridge.update(toState(p)),
      onKeyDown: (p: SuggestionKeyDownProps) => bridge.keyDown(p.event),
      onExit: () => bridge.update(null),
    }),
  };
}

export function MentionMenu({ state, index }: { state: MenuState; index: number }) {
  if (!state || !state.rect || state.items.length === 0) return null;
  const { rect, items, select } = state;
  return (
    <div
      role="listbox"
      aria-label="Mencionar a una persona"
      data-testid="mention-menu"
      className="fixed z-50 w-[260px] rounded-md bg-[var(--popover)] p-1 text-sm shadow-[var(--shadow-pop)]"
      style={{ top: rect.bottom + 6, left: rect.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {items.map((m, i) => (
        <button key={m.id} role="option" aria-selected={i === index} onClick={() => select(m)} className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left ${i === index ? "bg-hover" : ""}`}>
          <Avatar name={m.name} color={m.color} size={22} />
          <span className="truncate">{m.name}</span>
        </button>
      ))}
    </div>
  );
}
