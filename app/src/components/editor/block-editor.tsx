"use client";

import type { Editor, Extensions, JSONContent } from "@tiptap/core";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect } from "react";
import { schemaExtensions, PersonMention } from "@/lib/editor/schema";
import type { NodaraProvider } from "@/lib/collab/provider";
import { t } from "@/lib/strings";
import { BlockHandle } from "./block-handle";
import { MediaDrop, nodeViewExtensions } from "./blocks";
import { DatabaseBlock, NodaraContext } from "./database-node";
import { FormatMenu } from "./format-menu";
import { MentionMenu, mentionSuggestion, useMentionBridge, type MentionMember } from "./mention-menu";
import { SlashCommand } from "./slash-extension";
import { SlashMenu, useSlashBridge } from "./slash-menu";

export type DocJson = JSONContent & { type: "doc" };

export function BlockEditor({
  pageId,
  initial,
  editable,
  onChange,
  onReady,
  collab,
  members = [],
  onComment,
}: {
  /** Página que contiene el editor (para crear bases de datos integradas y comentarios). */
  pageId?: string;
  initial: DocJson | null;
  editable: boolean;
  onChange: (doc: DocJson) => void;
  onReady?: (editor: Editor) => void;
  /** Con proveedor, el contenido vive en el documento Yjs compartido y se ignoran `initial`/`onChange`. */
  collab?: NodaraProvider;
  /** Personas mencionables con @. */
  members?: MentionMember[];
  /** Se llama al pulsar «Comentar» con texto seleccionado. */
  onComment?: (range: { from: number; to: number; text: string }) => void;
}) {
  const { bridge, state, index } = useSlashBridge();
  const mention = useMentionBridge();
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    content: collab ? undefined : (initial ?? undefined),
    extensions: [
      ...schemaExtensions({ collaborative: !!collab }).map((e) => {
        if (e.name === "databaseBlock") return DatabaseBlock;
        if (e.name in nodeViewExtensions) return nodeViewExtensions[e.name as keyof typeof nodeViewExtensions];
        if (e.name === "mention") return PersonMention.configure({ suggestion: mentionSuggestion(members, mention.bridge) });
        return e;
      }),
      Placeholder.configure({
        placeholder: ({ node }) => (node.type.name === "detailsSummary" ? t.toggleSummary : t.editorPlaceholder),
      }),
      MediaDrop,
      NodaraContext.configure({ pageId: pageId ?? null }),
      SlashCommand.configure({ bridge }),
      ...(collab
        ? ([
            Collaboration.configure({ document: collab.doc, field: "default" }),
            CollaborationCaret.configure({
              provider: collab,
              user: (collab.awareness.getLocalState() as { user: { name: string; color: string } } | null)?.user ?? { name: "Anónimo", color: "#787774" },
              render: (user) => {
                const caret = document.createElement("span");
                caret.className = "nd-caret";
                caret.style.borderColor = user.color;
                caret.setAttribute("data-testid", "remote-caret");
                const label = document.createElement("div");
                label.className = "nd-caret-label";
                label.style.backgroundColor = user.color;
                label.textContent = user.name;
                caret.append(label);
                return caret;
              },
            }),
          ] satisfies Extensions)
        : []),
    ],
    editorProps: { attributes: { class: "nd-editor", "aria-label": t.pageContent, "data-testid": "editor" } },
    onUpdate: ({ editor }) => {
      if (!collab) onChange(editor.getJSON() as DocJson);
    },
  });

  useEffect(() => {
    if (editor) onReady?.(editor);
  }, [editor, onReady]);
  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  return (
    <>
      <EditorContent editor={editor} />
      {editor && editable && <FormatMenu editor={editor} onComment={onComment} />}
      {editor && editable && <BlockHandle editor={editor} />}
      <SlashMenu state={state} index={index} />
      <MentionMenu state={mention.state} index={mention.index} />
    </>
  );
}
