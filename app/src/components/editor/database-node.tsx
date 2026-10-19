"use client";

import { Extension, mergeAttributes, Node, type Editor } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
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

/** Bloque de base de datos integrada: referencia una colección por id. */
export const DatabaseBlock = Node.create({
  name: "databaseBlock",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      collectionId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-collection-id"),
        renderHTML: (attrs) => (attrs.collectionId ? { "data-collection-id": attrs.collectionId } : {}),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="database-block"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "database-block" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(DatabaseNodeView);
  },
});
