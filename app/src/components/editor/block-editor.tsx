"use client";

import type { Editor, Extensions, JSONContent } from "@tiptap/core";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { schemaExtensions, PersonMention } from "@/lib/editor/schema";
import type { NodaraProvider } from "@/lib/collab/provider";
import { t } from "@/lib/strings";
import { EmojiPicker } from "../emoji-picker";
import { useOptionalWorkspace } from "../workspace-provider";
import { BlockHandle } from "./block-handle";
import { MediaDrop, nodeViewExtensions, RichCodeBlock } from "./blocks";
import { DatabaseBlock, NodaraContext } from "./database-node";
import { FormatMenu } from "./format-menu";
import {
  MentionMenu,
  mentionSuggestion,
  useMentionBridge,
  type MentionMember,
} from "./mention-menu";
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
  const ws = useOptionalWorkspace();
  const router = useRouter();
  const [emoji, setEmoji] = useState<{
    x: number;
    y: number;
    insert: (e: string) => void;
  } | null>(null);
  // Contexto que necesitan algunas opciones del menú «/» (crear subpáginas, navegar, emoji); el plugin se crea una vez.
  useEffect(() => {
    const summary = (id: string) => {
      const p = ws?.pages.find((x) => x.id === id);
      return { id, title: p?.title ?? "", icon: p?.icon ?? null };
    };
    bridge.setContext(
      ws
        ? {
            createPage: async (parent) => summary(await ws.createPage(parent)),
            createDatabase: async (parent) =>
              summary(await ws.createDatabase(parent)),
            navigate: (id) => router.push(`/${id}`),
            openEmoji: (at, insert) => setEmoji({ ...at, insert }),
          }
        : null,
    );
  }, [ws, router, bridge]);
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    content: collab ? undefined : (initial ?? undefined),
    extensions: [
      ...schemaExtensions({
        collaborative: !!collab,
        codeBlock: RichCodeBlock,
      }).map((e) => {
        if (e.name === "databaseBlock") return DatabaseBlock;
        if (e.name in nodeViewExtensions)
          return nodeViewExtensions[e.name as keyof typeof nodeViewExtensions];
        if (e.name === "mention")
          return PersonMention.configure({
            suggestion: mentionSuggestion(members, mention.bridge),
          });
        return e;
      }),
      Placeholder.configure({
        placeholder: ({ node }) =>
          node.type.name === "detailsSummary"
            ? t.toggleSummary
            : t.editorPlaceholder,
      }),
      MediaDrop,
      NodaraContext.configure({ pageId: pageId ?? null }),
      SlashCommand.configure({ bridge }),
      ...(collab
        ? ([
            Collaboration.configure({ document: collab.doc, field: "default" }),
            CollaborationCaret.configure({
              provider: collab,
              user: (
                collab.awareness.getLocalState() as {
                  user: { name: string; color: string };
                } | null
              )?.user ?? { name: "Anónimo", color: "#787774" },
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
    editorProps: {
      attributes: {
        class: "nd-editor",
        "aria-label": t.pageContent,
        "data-testid": "editor",
      },
    },
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
      {editor && editable && (
        <FormatMenu editor={editor} onComment={onComment} />
      )}
      {editor && editable && (
        <BlockHandle editor={editor} onComment={onComment} />
      )}
      <SlashMenu state={state} index={index} onHover={bridge.setIndex} />
      {emoji && (
        <div className="fixed z-50" style={{ left: emoji.x, top: emoji.y }}>
          <EmojiPicker
            onPick={(e) => {
              if (e) emoji.insert(e);
              setEmoji(null);
            }}
            onClose={() => setEmoji(null)}
          />
        </div>
      )}
      <MentionMenu state={mention.state} index={mention.index} />
    </>
  );
}
