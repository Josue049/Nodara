"use client";

import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Bold, ChevronDown, Code, Italic, Link2, RemoveFormatting, Strikethrough, Underline } from "lucide-react";
import { useState } from "react";
import { t } from "@/lib/strings";
import { SWATCHES } from "./colors";

const TURN_INTO: { id: string; label: string; run: (e: Editor) => void }[] = [
  { id: "text", label: "Texto", run: (e) => e.chain().focus().clearNodes().run() },
  { id: "h1", label: "Encabezado 1", run: (e) => e.chain().focus().clearNodes().setHeading({ level: 1 }).run() },
  { id: "h2", label: "Encabezado 2", run: (e) => e.chain().focus().clearNodes().setHeading({ level: 2 }).run() },
  { id: "h3", label: "Encabezado 3", run: (e) => e.chain().focus().clearNodes().setHeading({ level: 3 }).run() },
  { id: "bullet", label: "Lista con viñetas", run: (e) => e.chain().focus().clearNodes().toggleBulletList().run() },
  { id: "number", label: "Lista numerada", run: (e) => e.chain().focus().clearNodes().toggleOrderedList().run() },
  { id: "todo", label: "Lista de tareas", run: (e) => e.chain().focus().clearNodes().toggleTaskList().run() },
  { id: "quote", label: "Cita", run: (e) => e.chain().focus().clearNodes().toggleBlockquote().run() },
  { id: "code", label: "Código", run: (e) => e.chain().focus().clearNodes().toggleCodeBlock().run() },
];

function currentBlockLabel(e: Editor): string {
  if (e.isActive("heading", { level: 1 })) return "Encabezado 1";
  if (e.isActive("heading", { level: 2 })) return "Encabezado 2";
  if (e.isActive("heading", { level: 3 })) return "Encabezado 3";
  if (e.isActive("taskList")) return "Lista de tareas";
  if (e.isActive("bulletList")) return "Lista con viñetas";
  if (e.isActive("orderedList")) return "Lista numerada";
  if (e.isActive("blockquote")) return "Cita";
  if (e.isActive("codeBlock")) return "Código";
  return "Texto";
}

const normalizeHref = (v: string) => (/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`);

type Panel = null | "turn" | "color" | "link";

/** Menú flotante de formato al seleccionar texto (equivalente observado en Notion: convertir en, B/I/U, enlace, tachado, código, color). */
export function FormatMenu({ editor }: { editor: Editor }) {
  const [panel, setPanel] = useState<Panel>(null);
  const [href, setHref] = useState("");
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      link: e.isActive("link"),
      label: currentBlockLabel(e),
      linkHref: (e.getAttributes("link").href as string | undefined) ?? "",
    }),
  });

  const btn = (label: string, active: boolean, run: () => void, icon: React.ReactNode) => (
    <button
      key={label}
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
      className={`flex size-8 items-center justify-center rounded-md hover:bg-hover ${active ? "bg-active text-accent" : ""}`}
    >
      {icon}
    </button>
  );

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "bottom-start", offset: 8, onHide: () => setPanel(null) }}
      shouldShow={({ editor: e, state: s }) => e.isEditable && !s.selection.empty && !e.isActive("codeBlock")}
    >
      <div
        role="toolbar"
        aria-label={t.formatting}
        data-testid="format-menu"
        className="w-[230px] rounded-[10px] bg-[var(--popover)] p-1.5 text-[14px] shadow-[var(--shadow-pop)]"
        onMouseDown={(e) => e.target instanceof HTMLInputElement || e.preventDefault()}
      >
        <button
          type="button"
          onClick={() => setPanel(panel === "turn" ? null : "turn")}
          aria-expanded={panel === "turn"}
          aria-haspopup="listbox"
          className="flex h-8 w-full items-center justify-between rounded-md px-2 hover:bg-hover"
        >
          <span data-testid="turn-into-label">{state.label}</span>
          <ChevronDown size={14} className="text-ink-3" />
        </button>
        {panel === "turn" && (
          <ul role="listbox" className="mt-1 border-t border-line pt-1">
            {TURN_INTO.map((o) => (
              <li key={o.id}>
                <button
                  role="option"
                  aria-selected={o.label === state.label}
                  onClick={() => {
                    o.run(editor);
                    setPanel(null);
                  }}
                  className="flex h-8 w-full items-center rounded-md px-2 text-left hover:bg-hover"
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-1 grid grid-cols-6 gap-0.5 border-t border-line pt-1.5">
          {btn(t.bold, state.bold, () => editor.chain().focus().toggleBold().run(), <Bold size={16} />)}
          {btn(t.italic, state.italic, () => editor.chain().focus().toggleItalic().run(), <Italic size={16} />)}
          {btn(t.underline, state.underline, () => editor.chain().focus().toggleUnderline().run(), <Underline size={16} />)}
          {btn(t.strike, state.strike, () => editor.chain().focus().toggleStrike().run(), <Strikethrough size={16} />)}
          {btn(t.codeInline, state.code, () => editor.chain().focus().toggleCode().run(), <Code size={16} />)}
          {btn(
            t.link,
            state.link,
            () => {
              setHref(state.linkHref);
              setPanel(panel === "link" ? null : "link");
            },
            <Link2 size={16} />,
          )}
          {btn(t.color, panel === "color", () => setPanel(panel === "color" ? null : "color"), <span className="text-[15px] font-semibold underline decoration-accent decoration-2">A</span>)}
          {btn(
            t.clearFormat,
            false,
            () => editor.chain().focus().unsetAllMarks().run(),
            <RemoveFormatting size={16} />,
          )}
        </div>
        {panel === "link" && (
          <form
            className="mt-1.5 flex gap-1 border-t border-line pt-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              const v = href.trim();
              if (!v) editor.chain().focus().extendMarkRange("link").unsetLink().run();
              else editor.chain().focus().extendMarkRange("link").setLink({ href: normalizeHref(v) }).run();
              setPanel(null);
            }}
          >
            <input
              autoFocus
              value={href}
              onChange={(e) => setHref(e.target.value)}
              placeholder={t.linkPlaceholder}
              aria-label={t.link}
              className="min-w-0 flex-1 rounded-md border border-line bg-transparent px-2 py-1 outline-none focus:border-accent"
            />
          </form>
        )}
        {panel === "color" && (
          <div className="mt-1.5 border-t border-line pt-1.5" data-testid="color-panel">
            <p className="px-1 pb-1 text-[12px] text-ink-3">{t.textColor}</p>
            <div className="grid grid-cols-5 gap-1">
              {SWATCHES.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  aria-label={`${t.textColor}: ${s.name}`}
                  title={s.name}
                  onClick={() => (s.text ? editor.chain().focus().setColor(s.text).run() : editor.chain().focus().unsetColor().run())}
                  className="flex size-8 items-center justify-center rounded-md border border-line text-[15px] font-semibold hover:bg-hover"
                  style={{ color: s.text ?? undefined }}
                >
                  A
                </button>
              ))}
            </div>
            <p className="px-1 pt-2 pb-1 text-[12px] text-ink-3">{t.highlightColor}</p>
            <div className="grid grid-cols-5 gap-1">
              {SWATCHES.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  aria-label={`${t.highlightColor}: ${s.name}`}
                  title={s.name}
                  onClick={() =>
                    s.bg ? editor.chain().focus().setHighlight({ color: s.bg }).run() : editor.chain().focus().unsetHighlight().run()
                  }
                  className="size-8 rounded-md border border-line hover:brightness-95"
                  style={{ background: s.bg ?? "transparent" }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </BubbleMenu>
  );
}
