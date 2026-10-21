"use client";

import type { Editor } from "@tiptap/core";
import { Check, ChevronRight, Copy, MessageSquareText, Palette, Repeat2, Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { blockIdOfNode, blockTypeLabel, colorBlock, countText, deleteBlock, duplicateBlock, focusBlock, isConvertible, TURN_ICONS, TURN_INTO } from "./block-actions";
import { SWATCHES } from "./colors";
import { MenuIcon } from "./slash-menu";

type Action = { id: string; label: string; icon: React.ReactNode; hint?: string; sub?: "turn" | "color"; run?: () => void; group: number };
type SubItem = { id: string; label: string; icon: React.ReactNode; checked?: boolean; run: () => void; header?: string };

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const WIDTH = 265;

/**
 * Menú de acciones del bloque (asa «⋮⋮»: clic o clic derecho): buscador, tipo de bloque,
 * Convertir en ›, Color ›, Duplicar, Eliminar, Comentar y recuento de palabras al pie.
 */
export function BlockMenu({
  editor,
  pos,
  anchor,
  onClose,
  onComment,
}: {
  editor: Editor;
  pos: number;
  anchor: DOMRect;
  onClose: () => void;
  onComment?: (range: { from: number; to: number; text: string }) => void;
}) {
  const node = editor.state.doc.nodeAt(pos);
  const root = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [index, setIndex] = useState(0);
  const [sub, setSub] = useState<null | "turn" | "color">(null);
  const [subIndex, setSubIndex] = useState(0);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);

  // Cursor dentro del bloque para que «Convertir en» actúe sobre él.
  const select = () => focusBlock(editor, pos);
  const done = (fn: () => void) => () => {
    fn();
    onClose();
  };

  const text = node?.textContent ?? "";
  const convertible = !!node && isConvertible(node);
  const actions: Action[] = useMemo(() => {
    if (!node) return [];
    const out: Action[] = [];
    if (convertible) {
      out.push({ id: "turn", label: "Convertir en", icon: <Repeat2 size={18} strokeWidth={1.5} />, sub: "turn", group: 0 });
      out.push({ id: "color", label: "Color", icon: <Palette size={18} strokeWidth={1.5} />, sub: "color", group: 0 });
    }
    out.push({ id: "duplicate", label: "Duplicar", icon: <Copy size={18} strokeWidth={1.5} />, hint: "Ctrl+D", run: () => duplicateBlock(editor, pos), group: 1 });
    out.push({ id: "delete", label: "Eliminar", icon: <Trash2 size={18} strokeWidth={1.5} />, hint: "Supr", run: () => deleteBlock(editor, pos), group: 1 });
    if (onComment && text.trim())
      out.push({
        id: "comment",
        label: "Comentar",
        icon: <MessageSquareText size={18} strokeWidth={1.5} />,
        hint: "Ctrl+Mayús+M",
        run: () => {
          const from = pos + 1;
          const to = pos + node.nodeSize - 1;
          editor.chain().focus().setTextSelection({ from, to }).run();
          onComment({ from, to, text: editor.state.doc.textBetween(from, to, " ") });
        },
        group: 2,
      });
    return out;
  }, [node, convertible, editor, pos, onComment, text]);

  const currentType = node ? blockIdOfNode(node) : null;

  const turnItems: SubItem[] = TURN_INTO.map((t) => ({ id: `turn-${t.id}`, label: t.label, icon: <MenuIcon icon={TURN_ICONS[t.id] ?? Repeat2} />, checked: t.id === currentType, run: () => (select(), t.run(editor)) }));
  const colorItems: SubItem[] = [
    ...SWATCHES.map((s, i) => ({ id: `text-${i}`, header: i === 0 ? "Color del texto" : undefined, label: s.text ? `Texto ${s.name.toLowerCase()}` : "Texto predeterminado", icon: <MenuIcon icon={{ swatch: s.text, kind: "text" }} />, run: () => colorBlock(editor, pos, "text", s) })),
    ...SWATCHES.map((s, i) => ({ id: `bg-${i}`, header: i === 0 ? "Color de fondo" : undefined, label: s.bg ? `Fondo ${s.name.toLowerCase()}` : "Fondo predeterminado", icon: <MenuIcon icon={{ swatch: s.bg, kind: "bg" }} />, run: () => colorBlock(editor, pos, "bg", s) })),
  ];

  // Con texto en el buscador: lista plana de acciones, conversiones y colores que coinciden.
  const query = norm(q.trim());
  const flat: SubItem[] = query
    ? [
        ...actions.filter((a) => a.run).map((a) => ({ id: a.id, label: a.label, icon: a.icon, run: a.run! })),
        ...(convertible ? turnItems.map((t) => ({ ...t, label: `Convertir en ${t.label.toLowerCase()}`, checked: false })) : []),
        ...(convertible ? colorItems.map((c) => ({ ...c, header: undefined })) : []),
      ].filter((i) => norm(i.label).includes(query))
    : [];
  const mainCount = query ? flat.length : actions.length;
  const subItems = sub === "turn" ? turnItems : sub === "color" ? colorItems : [];

  useLayoutEffect(() => {
    const h = root.current?.offsetHeight ?? 360;
    const fitsLeft = anchor.left - 6 - WIDTH >= 8;
    const left = fitsLeft ? anchor.left - 6 - WIDTH : Math.min(anchor.right + 6, window.innerWidth - WIDTH - 8);
    setPlace({ left, top: Math.max(8, Math.min(anchor.top - 40, window.innerHeight - h - 8)) });
  }, [anchor]);

  useEffect(() => {
    const down = (e: MouseEvent) => !root.current?.contains(e.target as Node) && onClose();
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [onClose]);

  const activate = (i: number) => {
    if (query) return flat[i] && done(flat[i].run)();
    const a = actions[i];
    if (!a) return;
    if (a.sub) {
      setSub(a.sub);
      setSubIndex(0);
    } else if (a.run) done(a.run)();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const k = e.key;
    // El menú se queda con sus teclas: Ctrl+D no debe llegar al atajo global que duplica la página.
    if (["Escape", "Enter", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Delete"].includes(k) || e.ctrlKey || e.metaKey) e.stopPropagation();
    const mod = e.ctrlKey || e.metaKey;
    // Atajos con el menú abierto: actúan sobre el bloque.
    if (mod && !e.shiftKey && k.toLowerCase() === "d") return e.preventDefault(), done(() => duplicateBlock(editor, pos))();
    if (mod && e.shiftKey && k.toLowerCase() === "m") return e.preventDefault(), actions.find((a) => a.id === "comment") && done(actions.find((a) => a.id === "comment")!.run!)();
    if (k === "Delete" && !q) return e.preventDefault(), done(() => deleteBlock(editor, pos))();
    if (k === "Escape") {
      e.preventDefault();
      if (sub) setSub(null);
      else onClose();
      return;
    }
    if (sub) {
      if (k === "ArrowDown" || k === "ArrowUp") {
        e.preventDefault();
        setSubIndex((i) => (i + (k === "ArrowDown" ? 1 : -1) + subItems.length) % subItems.length);
      } else if (k === "Enter") {
        e.preventDefault();
        done(subItems[subIndex].run)();
      } else if (k === "ArrowLeft") {
        e.preventDefault();
        setSub(null);
      }
      return;
    }
    if (k === "ArrowDown" || k === "ArrowUp") {
      e.preventDefault();
      if (mainCount) setIndex((i) => (i + (k === "ArrowDown" ? 1 : -1) + mainCount) % mainCount);
    } else if (k === "Enter") {
      e.preventDefault();
      activate(index);
    } else if (k === "ArrowRight" && !query && actions[index]?.sub) {
      e.preventDefault();
      activate(index);
    }
  };

  if (!node) return null;
  const counts = countText(text);
  return (
    <div
      ref={root}
      className="nd-menu nd-fade fixed z-[60] flex flex-col"
      style={{ width: WIDTH, left: place?.left ?? -9999, top: place?.top ?? 0 }}
      role="dialog"
      aria-label="Acciones del bloque"
      data-testid="block-menu"
      onKeyDown={onKeyDown}
    >
      <div className="px-2 pb-1 pt-2">
        <input
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setIndex(0);
            setSub(null);
          }}
          placeholder="Buscar acciones…"
          aria-label="Buscar acciones"
          className="nd-menu-search"
          data-testid="block-menu-search"
        />
      </div>
      <div role="menu" aria-label={blockTypeLabel(node)} className="pb-1">
        {query ? (
          <>
            {flat.length === 0 && <p className="nd-menu-empty">Sin resultados</p>}
            {flat.map((it, i) => (
              <button key={it.id} type="button" role="menuitem" data-active={i === index} onMouseMove={() => setIndex(i)} onClick={done(it.run)} className="nd-menu-item nd-menu-compact">
                <span className="nd-menu-icon">{it.icon}</span>
                <span className="truncate">{it.label}</span>
              </button>
            ))}
          </>
        ) : (
          <>
            <div className="nd-menu-header" data-testid="block-menu-type">
              {blockTypeLabel(node)}
            </div>
            {actions.map((a, i) => (
              <div key={a.id}>
                {i > 0 && actions[i - 1].group !== a.group && <div className="nd-menu-sep mb-1" role="separator" />}
                <button
                  type="button"
                  role="menuitem"
                  aria-haspopup={a.sub ? "menu" : undefined}
                  aria-expanded={a.sub ? sub === a.sub : undefined}
                  data-active={i === index || (a.sub !== undefined && sub === a.sub)}
                  onMouseMove={() => {
                    setIndex(i);
                    if (a.sub && sub !== a.sub) {
                      setSub(a.sub);
                      setSubIndex(0);
                    } else if (!a.sub && sub) setSub(null);
                  }}
                  onClick={() => activate(i)}
                  className="nd-menu-item nd-menu-compact"
                >
                  <span className="nd-menu-icon">{a.icon}</span>
                  <span className="truncate">{a.label}</span>
                  {a.hint && <span className="nd-menu-hint">{a.hint}</span>}
                  {a.sub && <ChevronRight size={16} className="ml-auto text-ink-3" aria-hidden />}
                </button>
              </div>
            ))}
          </>
        )}
      </div>
      <div className="nd-menu-foot" data-testid="block-menu-count">
        {counts.words} {counts.words === 1 ? "palabra" : "palabras"}, {counts.chars} {counts.chars === 1 ? "carácter" : "caracteres"}
      </div>
      {sub && (
        <div
          className="nd-menu nd-fade nd-scroll absolute max-h-[420px] w-[240px] overflow-y-auto py-1"
          style={{ left: WIDTH + 4, top: 40 }}
          role="menu"
          aria-label={sub === "turn" ? "Convertir en" : "Color"}
          data-testid={sub === "turn" ? "block-menu-turn" : "block-menu-color"}
        >
          {subItems.map((it, i) => (
            <div key={it.id}>
              {it.header && <div className="nd-menu-header">{it.header}</div>}
              <button type="button" role="menuitem" data-active={i === subIndex} onMouseMove={() => setSubIndex(i)} onClick={done(it.run)} className="nd-menu-item nd-menu-compact">
                {it.icon && <span className="nd-menu-icon">{it.icon}</span>}
                <span className="truncate">{it.label}</span>
                {it.checked && <Check size={16} className="ml-auto" aria-label="Actual" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
