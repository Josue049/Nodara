"use client";

import { Extension, type Editor } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { DatabaseBlockBase } from "@/lib/editor/schema";
import { DatabaseView } from "../database/database-view";

/** Guarda el id de la página que contiene el editor, para crear bases de datos integradas desde el menú /. */
export const NodaraContext = Extension.create<{ pageId: string | null }>({
  name: "nodaraContext",
  addOptions: () => ({ pageId: null }),
});

export const getPageId = (editor: Editor): string | null =>
  (editor.extensionManager.extensions.find((x) => x.name === "nodaraContext")?.options as { pageId?: string | null } | undefined)?.pageId ?? null;

function DatabaseNodeView({ node }: NodeViewProps) {
  const collectionId = node.attrs.collectionId as string | null;
  return (
    <NodeViewWrapper className="my-2" data-testid="database-block" contentEditable={false}>
      {collectionId ? <DatabaseView collectionId={collectionId} inline /> : null}
    </NodeViewWrapper>
  );
}

/** Bloque de base de datos integrada con su vista React (el esquema vive en lib/editor/schema). */
export const DatabaseBlock = DatabaseBlockBase.extend({
  addNodeView() {
    return ReactNodeViewRenderer(DatabaseNodeView);
  },
});
