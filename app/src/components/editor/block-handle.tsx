"use client";

import type { Editor } from "@tiptap/core";
import { DragHandle } from "@tiptap/extension-drag-handle-react";
import { Copy, GripVertical, Plus, Trash2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { t } from "@/lib/strings";
import { PopoverMenu } from "../popover-menu";

type Hovered = { pos: number; size: number } | null;

// Props estables: si cambian entre renders, DragHandle re-registra su plugin y reinicia el estado de otros plugins (p. ej. el menú /).
const POSITION_CONFIG = { placement: "left-start" } as const;

/** Asa de bloque (observada en Notion): «+» inserta debajo y abre el menú /, «⠿» arrastra y abre acciones del bloque. */
export function BlockHandle({ editor }: { editor: Editor }) {
  const hovered = useRef<Hovered>(null);
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  const [menuBlock, setMenuBlock] = useState<Hovered>(null);

  const onNodeChange = useCallback(({ node, pos }: { node: { nodeSize: number } | null; pos: number }) => {
    hovered.current = node ? { pos, size: node.nodeSize } : null;
  }, []);

  const insertBelow = () => {
    const h = hovered.current;
    if (!h) return;
    const at = h.pos + h.size;
    editor.chain().focus().insertContentAt(at, { type: "paragraph" }).setTextSelection(at + 1).insertContent("/").run();
  };

  return (
    <>
      <DragHandle
        editor={editor}
        onNodeChange={onNodeChange}
        computePositionConfig={POSITION_CONFIG}
      >
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
            data-testid="drag-grip"
            onClick={(e) => {
              if (!hovered.current) return;
              const r = e.currentTarget.getBoundingClientRect();
              setMenuBlock(hovered.current);
              setMenuAt({ x: r.left, y: r.bottom + 4 });
            }}
            className="flex size-6 cursor-grab items-center justify-center rounded text-ink-3 hover:bg-hover"
          >
            <GripVertical size={16} />
          </button>
        </div>
      </DragHandle>
      {menuAt && menuBlock && (
        <PopoverMenu
          at={menuAt}
          onClose={() => setMenuAt(null)}
          items={[
            {
              label: t.deleteBlock,
              icon: <Trash2 size={16} />,
              danger: true,
              onSelect: () => editor.chain().focus().deleteRange({ from: menuBlock.pos, to: menuBlock.pos + menuBlock.size }).run(),
            },
            {
              label: t.duplicate,
              icon: <Copy size={16} />,
              onSelect: () => {
                const node = editor.state.doc.nodeAt(menuBlock.pos);
                if (node) editor.chain().focus().insertContentAt(menuBlock.pos + menuBlock.size, node.toJSON()).run();
              },
            },
          ]}
        />
      )}
    </>
  );
}
