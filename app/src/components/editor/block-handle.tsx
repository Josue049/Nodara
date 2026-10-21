"use client";

import type { Editor } from "@tiptap/core";
import { DragHandle } from "@tiptap/extension-drag-handle-react";
import { GripVertical, Plus } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { t } from "@/lib/strings";
import { BlockMenu } from "./block-menu";

type Hovered = { pos: number; size: number } | null;

// Props estables: si cambian entre renders, DragHandle re-registra su plugin y reinicia el estado de otros plugins (p. ej. el menú /).
const POSITION_CONFIG = { placement: "left-start" } as const;

/**
 * Asa de bloque (observada en Notion): «+» inserta debajo y abre el menú /; «⠿» arrastra y, con clic o clic derecho,
 * abre el menú de acciones del bloque.
 */
export function BlockHandle({ editor, onComment }: { editor: Editor; onComment?: (range: { from: number; to: number; text: string }) => void }) {
  const hovered = useRef<Hovered>(null);
  const [menu, setMenu] = useState<{ pos: number; anchor: DOMRect } | null>(null);

  const onNodeChange = useCallback(({ node, pos }: { node: { nodeSize: number } | null; pos: number }) => {
    hovered.current = node ? { pos, size: node.nodeSize } : null;
  }, []);

  const insertBelow = () => {
    const h = hovered.current;
    if (!h) return;
    const at = h.pos + h.size;
    editor.chain().focus().insertContentAt(at, { type: "paragraph" }).setTextSelection(at + 1).insertContent("/").run();
  };
  const openMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!hovered.current) return;
    setMenu({ pos: hovered.current.pos, anchor: e.currentTarget.getBoundingClientRect() });
  };
  const closeMenu = useCallback(() => setMenu(null), []);

  return (
    <>
      <DragHandle editor={editor} onNodeChange={onNodeChange} computePositionConfig={POSITION_CONFIG}>
        <div className="flex items-center gap-0.5 pr-1 opacity-60 hover:opacity-100" data-testid="block-handle">
          <button
            type="button"
            aria-label={t.addBlockBelow}
            title={t.addBlockBelow}
            onClick={insertBelow}
            className="flex size-6 items-center justify-center rounded text-ink-3 hover:bg-hover"
          >
            <Plus size={16} />
          </button>
          <button
            type="button"
            aria-label={t.dragBlock}
            title={t.dragBlock}
            aria-haspopup="dialog"
            aria-expanded={!!menu}
            data-testid="drag-grip"
            onClick={openMenu}
            onContextMenu={openMenu}
            className="flex size-6 cursor-grab items-center justify-center rounded text-ink-3 hover:bg-hover"
          >
            <GripVertical size={16} />
          </button>
        </div>
      </DragHandle>
      {menu && <BlockMenu key={`${menu.pos}-${menu.anchor.top}`} editor={editor} pos={menu.pos} anchor={menu.anchor} onClose={closeMenu} onComment={onComment} />}
    </>
  );
}
