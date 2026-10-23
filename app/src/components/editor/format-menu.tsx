"use client";

import type { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Bold, Check, ChevronDown, Code, Italic, Link2, MessageSquareText, RemoveFormatting, Strikethrough, Underline } from "lucide-react";
import { useEffect, useState } from "react";
import { t } from "@/lib/strings";
import { currentBlockLabel, recentColors, rememberColor, TURN_ICONS, TURN_INTO, withColor, type ColorKind, type RecentColor } from "./block-actions";
import { SWATCHES, swatchOf, TEXT_SWATCHES, themedColor, type Swatch } from "./colors";

const normalizeHref = (v: string) => (/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`);

type Panel = null | "turn" | "color" | "link";

const Sep = () => <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-[var(--menu-sep)]" />;

/** Cuadro de muestra «A» de una opción de color. */
function ColorChip({ kind, swatch }: { kind: ColorKind; swatch: Swatch }) {
  return (
    <span
      aria-hidden
      className="nd-menu-swatch"
      style={kind === "text" ? { color: swatch.text ?? undefined } : { background: swatch.bg ?? undefined }}
    >
      A
    </span>
  );
}

/**
 * Barra flotante al seleccionar texto: convertir el bloque, enlace, comentario, formato en línea, color y borrar formato.
 * Los desplegables («Convertir en», «Color» y el enlace) se abren bajo la barra.
 */
export function FormatMenu({ editor, onComment }: { editor: Editor; onComment?: (range: { from: number; to: number; text: string }) => void }) {
  const [panel, setPanel] = useState<Panel>(null);
  const [href, setHref] = useState("");
  const [recent, setRecent] = useState<RecentColor[]>([]);
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
      color: (e.getAttributes("textStyle").color as string | undefined) ?? null,
      bg: (e.getAttributes("highlight").color as string | undefined) ?? null,
    }),
  });

  const toggle = (p: Panel) => setPanel(panel === p ? null : p);

  // Escape cierra primero el desplegable abierto (el foco sigue en el editor).
  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setPanel(null);
      editor.commands.focus();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [panel, editor]);

  const btn = (label: string, active: boolean, run: () => void, icon: React.ReactNode, shortcut?: string) => (
    <button
      key={label}
      type="button"
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
      className={`flex h-7 min-w-7 items-center justify-center rounded-md px-1 hover:bg-hover ${active ? "text-accent" : "text-ink"}`}
    >
      {icon}
    </button>
  );

  const pickColor = (kind: ColorKind, s: Swatch) => {
    withColor(editor.chain().focus(), kind, s).run();
    rememberColor(kind, s);
    setPanel(null);
  };

  const colorRow = (kind: ColorKind, s: Swatch, current: boolean, key: string) => {
    const label = kind === "text" ? t.textColor : t.highlightColor;
    const name = kind === "text" ? (s.text ? `Texto ${s.name.toLowerCase()}` : "Texto predeterminado") : s.bg ? `Fondo ${s.name.toLowerCase()}` : "Fondo predeterminado";
    return (
      <button
        key={key}
        type="button"
        role="menuitemradio"
        aria-checked={current}
        aria-label={`${label}: ${s.name}`}
        onClick={() => pickColor(kind, s)}
        className="flex h-7 w-full items-center gap-2 rounded-md px-1.5 text-left hover:bg-hover"
      >
        <ColorChip kind={kind} swatch={s} />
        <span className="min-w-0 flex-1 truncate">{name}</span>
        {current && <Check size={14} className="shrink-0 text-ink-2" />}
      </button>
    );
  };

  const curText = state.bg ? undefined : swatchOf(state.color, "text");
  const curBg = state.color ? undefined : swatchOf(state.bg, "bg");
  const recentSwatches = recent
    .map((r) => ({ kind: r.kind, s: (r.kind === "text" ? TEXT_SWATCHES : SWATCHES).find((x) => x.id === r.id) }))
    .filter((r): r is { kind: ColorKind; s: Swatch } => !!r.s);

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top-start", offset: 8, flip: true, onHide: () => setPanel(null) }}
      // Solo con texto seleccionado: no con un bloque seleccionado como nodo (imagen, vídeo, base de datos…).
      shouldShow={({ editor: e, state: s }) =>
        e.isEditable && s.selection instanceof TextSelection && !s.selection.empty && !!s.doc.textBetween(s.selection.from, s.selection.to).trim() && !e.isActive("codeBlock")
      }
    >
      <div
        role="toolbar"
        aria-label={t.formatting}
        data-testid="format-menu"
        className="relative flex h-9 items-center gap-0.5 whitespace-nowrap rounded-[10px] bg-[var(--popover)] px-1 text-[14px] shadow-[var(--shadow-menu)]"
        onMouseDown={(e) => e.target instanceof HTMLInputElement || e.preventDefault()}
      >
        <button
          type="button"
          onClick={() => toggle("turn")}
          aria-expanded={panel === "turn"}
          aria-haspopup="listbox"
          className="flex h-7 items-center gap-1 rounded-md px-1.5 text-ink hover:bg-hover"
        >
          <span data-testid="turn-into-label">{state.label}</span>
          <ChevronDown size={12} className="text-ink-3" />
        </button>
        <Sep />
        {btn(
          t.link,
          state.link,
          () => {
            setHref(state.linkHref);
            toggle("link");
          },
          <Link2 size={16} />,
          "Ctrl+K",
        )}
        {onComment && (
          <button
            type="button"
            data-testid="comment-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const { from, to } = editor.state.selection;
              onComment({ from, to, text: editor.state.doc.textBetween(from, to, " ").slice(0, 500) });
            }}
            className="flex h-7 items-center gap-1 rounded-md px-1.5 text-ink hover:bg-hover"
          >
            <MessageSquareText size={16} /> Comentar
          </button>
        )}
        <Sep />
        {btn(t.bold, state.bold, () => editor.chain().focus().toggleBold().run(), <Bold size={16} />, "Ctrl+B")}
        {btn(t.italic, state.italic, () => editor.chain().focus().toggleItalic().run(), <Italic size={16} />, "Ctrl+I")}
        {btn(t.underline, state.underline, () => editor.chain().focus().toggleUnderline().run(), <Underline size={16} />, "Ctrl+U")}
        {btn(t.strike, state.strike, () => editor.chain().focus().toggleStrike().run(), <Strikethrough size={16} />, "Ctrl+⇧+S")}
        {btn(t.codeInline, state.code, () => editor.chain().focus().toggleCode().run(), <Code size={16} />, "Ctrl+E")}
        <Sep />
        <button
          type="button"
          aria-label={t.color}
          title={t.color}
          aria-expanded={panel === "color"}
          aria-haspopup="menu"
          onClick={() => {
            setRecent(recentColors());
            toggle("color");
          }}
          className="flex h-7 items-center gap-0.5 rounded-md px-1.5 hover:bg-hover"
        >
          <span
            className="rounded-[3px] px-[3px] text-[15px] font-medium leading-5"
            style={{ color: state.color ? themedColor(state.color) : undefined, background: state.bg ? themedColor(state.bg) : undefined }}
          >
            A
          </span>
          <ChevronDown size={12} className="text-ink-3" />
        </button>
        <Sep />
        {btn(t.clearFormat, false, () => editor.chain().focus().unsetAllMarks().run(), <RemoveFormatting size={16} />)}

        {panel === "turn" && (
          <ul role="listbox" aria-label="Convertir en" className="absolute left-0 top-full mt-1.5 max-h-[340px] w-[220px] overflow-y-auto rounded-[10px] bg-[var(--popover)] p-1 shadow-[var(--shadow-menu)]">
            <li className="px-1.5 pb-1 pt-1 text-[12px] font-medium text-ink-3">Convertir en</li>
            {TURN_INTO.map((o) => {
              const Icon = TURN_ICONS[o.id];
              const current = o.label === state.label;
              return (
                <li key={o.id}>
                  <button
                    role="option"
                    aria-selected={current}
                    onClick={() => {
                      o.run(editor);
                      setPanel(null);
                    }}
                    className="flex h-7 w-full items-center gap-2 rounded-md px-1.5 text-left hover:bg-hover"
                  >
                    {Icon && <Icon size={16} className="shrink-0 text-ink-2" />}
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {current && <Check size={14} className="shrink-0 text-ink-2" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {panel === "color" && (
          <div role="menu" aria-label={t.color} data-testid="color-panel" className="absolute top-full mt-1.5 max-h-[400px] w-[220px] overflow-y-auto rounded-[10px] bg-[var(--popover)] p-1 shadow-[var(--shadow-menu)]" style={{ left: "calc(100% - 220px)" }}>
            {recentSwatches.length > 0 && (
              <>
                <p className="px-1.5 pb-1 pt-1 text-[12px] font-medium text-ink-3">Usados recientemente</p>
                {recentSwatches.map((r) => colorRow(r.kind, r.s, false, `recent-${r.kind}-${r.s.id}`))}
              </>
            )}
            <p className="px-1.5 pb-1 pt-1.5 text-[12px] font-medium text-ink-3">{t.textColor}</p>
            {TEXT_SWATCHES.map((s) => colorRow("text", s, curText?.id === s.id && (s.id !== "default" || !state.bg), `text-${s.id}`))}
            <p className="px-1.5 pb-1 pt-1.5 text-[12px] font-medium text-ink-3">{t.highlightColor}</p>
            {SWATCHES.map((s) => colorRow("bg", s, s.id !== "default" && curBg?.id === s.id, `bg-${s.id}`))}
          </div>
        )}

        {panel === "link" && (
          <form
            className="absolute left-0 top-full mt-1.5 flex w-[320px] gap-1 rounded-[10px] bg-[var(--popover)] p-1.5 shadow-[var(--shadow-menu)]"
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
      </div>
    </BubbleMenu>
  );
}
