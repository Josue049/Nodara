"use client";

import type { Editor, JSONContent } from "@tiptap/core";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import Placeholder from "@tiptap/extension-placeholder";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import { Highlight } from "@tiptap/extension-highlight";
import { TableKit } from "@tiptap/extension-table";
import { TaskItem } from "@tiptap/extension-task-item";
import { TaskList } from "@tiptap/extension-task-list";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import { t } from "@/lib/strings";
import { BlockHandle } from "./block-handle";
import { FormatMenu } from "./format-menu";
import { SlashCommand } from "./slash-extension";
import { SlashMenu, useSlashBridge } from "./slash-menu";

export type DocJson = JSONContent & { type: "doc" };

export function BlockEditor({
  initial,
  editable,
  onChange,
  onReady,
}: {
  initial: DocJson | null;
  editable: boolean;
  onChange: (doc: DocJson) => void;
  onReady?: (editor: Editor) => void;
}) {
  const { bridge, state, index } = useSlashBridge();
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    content: initial ?? undefined,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" } },
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TableKit.configure({ table: { resizable: true } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Details.configure({ persist: true, HTMLAttributes: { class: "nd-details" } }),
      DetailsSummary,
      DetailsContent,
      Placeholder.configure({
        placeholder: ({ node }) => (node.type.name === "detailsSummary" ? t.toggleSummary : t.editorPlaceholder),
      }),
      SlashCommand.configure({ bridge }),
    ],
    editorProps: { attributes: { class: "nd-editor", "aria-label": t.pageContent, "data-testid": "editor" } },
    onUpdate: ({ editor }) => onChange(editor.getJSON() as DocJson),
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
      {editor && editable && <FormatMenu editor={editor} />}
      {editor && editable && <BlockHandle editor={editor} />}
      <SlashMenu state={state} index={index} />
    </>
  );
}
