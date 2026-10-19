/**
 * Definición del esquema del editor, sin dependencias de React ni del DOM: la usan el cliente (TipTap) y el servidor
 * (conversión entre JSON de ProseMirror y documentos Yjs para la edición colaborativa).
 */
import { mergeAttributes, Mark, Node, type Extensions } from "@tiptap/core";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import { Highlight } from "@tiptap/extension-highlight";
import Mention from "@tiptap/extension-mention";
import { TableKit } from "@tiptap/extension-table";
import { TaskItem } from "@tiptap/extension-task-item";
import { TaskList } from "@tiptap/extension-task-list";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import StarterKit from "@tiptap/starter-kit";

/** Bloque de base de datos integrada: referencia una colección por id. La vista React se añade en el cliente. */
export const DatabaseBlockBase = Node.create({
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
});

/** Marca de comentario: resalta el texto al que se ancla un hilo de comentarios. */
export const CommentMark = Mark.create({
  name: "comment",
  inclusive: false,
  excludes: "",
  addAttributes() {
    return {
      threadId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-thread-id"),
        renderHTML: (attrs) => (attrs.threadId ? { "data-thread-id": attrs.threadId } : {}),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-thread-id]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "nd-comment" }), 0];
  },
});

/** Mención de una persona del espacio de trabajo (@nombre). Guarda el id del usuario. */
export const PersonMention = Mention.extend({
  name: "mention",
  renderText({ node }) {
    return `@${node.attrs.label ?? node.attrs.id}`;
  },
}).configure({ HTMLAttributes: { class: "nd-mention" } });

/**
 * Extensiones que definen el esquema. `collaborative: true` desactiva el historial propio de ProseMirror
 * (la colaboración usa el historial de Yjs).
 */
export function schemaExtensions(opts: { collaborative?: boolean } = {}): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" } },
      ...(opts.collaborative ? { undoRedo: false } : {}),
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
    DatabaseBlockBase,
    CommentMark,
    PersonMention,
  ];
}
