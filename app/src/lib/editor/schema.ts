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

/** Llamada (callout): bloque destacado con icono y color, que contiene otros bloques. */
export const CALLOUT_COLORS = ["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"] as const;
export const CalloutBase = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return {
      icon: { default: "💡", parseHTML: (el) => el.getAttribute("data-icon") ?? "💡", renderHTML: (a) => ({ "data-icon": a.icon }) },
      color: { default: "gray", parseHTML: (el) => el.getAttribute("data-color") ?? "gray", renderHTML: (a) => ({ "data-color": a.color }) },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "callout", class: "nd-callout" }), ["span", { class: "nd-callout-icon", contenteditable: "false" }, String(node.attrs.icon)], ["div", { class: "nd-callout-body" }, 0]];
  },
});

/** Imagen (subida al servidor o por URL) con ancho y pie de foto. */
export const ImageBlockBase = Node.create({
  name: "imageBlock",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: "" },
      alt: { default: "" },
      caption: { default: "" },
      width: { default: 100 }, // porcentaje del ancho disponible
      align: { default: "center" },
    };
  },
  parseHTML() {
    return [{ tag: 'figure[data-type="image-block"]', getAttrs: (el) => ({ src: (el as HTMLElement).querySelector("img")?.getAttribute("src") ?? "", alt: (el as HTMLElement).querySelector("img")?.getAttribute("alt") ?? "", caption: (el as HTMLElement).querySelector("figcaption")?.textContent ?? "" }) }];
  },
  renderHTML({ node }) {
    return ["figure", { "data-type": "image-block", class: "nd-image" }, ["img", { src: node.attrs.src, alt: node.attrs.alt, style: `width:${node.attrs.width}%` }], ...(node.attrs.caption ? [["figcaption", {}, node.attrs.caption]] : [])] as never;
  },
});

/** Archivo adjunto: enlace de descarga con nombre y tamaño. */
export const FileBlockBase = Node.create({
  name: "fileBlock",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { url: { default: "" }, name: { default: "Archivo" }, size: { default: 0 } };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="file-block"]', getAttrs: (el) => ({ url: (el as HTMLElement).getAttribute("data-url") ?? "", name: (el as HTMLElement).textContent ?? "Archivo" }) }];
  },
  renderHTML({ node }) {
    return ["div", { "data-type": "file-block", "data-url": node.attrs.url, class: "nd-file" }, String(node.attrs.name)];
  },
});

/** Marcador: tarjeta con un enlace externo. */
export const BookmarkBase = Node.create({
  name: "bookmark",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { url: { default: "" }, title: { default: "" } };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="bookmark"]', getAttrs: (el) => ({ url: (el as HTMLElement).getAttribute("data-url") ?? "", title: (el as HTMLElement).textContent ?? "" }) }];
  },
  renderHTML({ node }) {
    return ["div", { "data-type": "bookmark", "data-url": node.attrs.url, class: "nd-bookmark" }, String(node.attrs.title || node.attrs.url)];
  },
});

/** Ecuación en bloque (LaTeX, representada con KaTeX en el cliente). */
export const MathBlockBase = Node.create({
  name: "mathBlock",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { latex: { default: "" } };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="math-block"]', getAttrs: (el) => ({ latex: (el as HTMLElement).getAttribute("data-latex") ?? "" }) }];
  },
  renderHTML({ node }) {
    return ["div", { "data-type": "math-block", "data-latex": node.attrs.latex, class: "nd-math" }, String(node.attrs.latex)];
  },
  renderText: ({ node }) => String(node.attrs.latex),
});

/** Ecuación en línea. */
export const MathInlineBase = Node.create({
  name: "mathInline",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return { latex: { default: "" } };
  },
  parseHTML() {
    return [{ tag: 'span[data-type="math-inline"]', getAttrs: (el) => ({ latex: (el as HTMLElement).getAttribute("data-latex") ?? "" }) }];
  },
  renderHTML({ node }) {
    return ["span", { "data-type": "math-inline", "data-latex": node.attrs.latex, class: "nd-math-inline" }, String(node.attrs.latex)];
  },
  renderText: ({ node }) => String(node.attrs.latex),
});

/** Tabla de contenidos: se genera a partir de los encabezados de la página (sin contenido propio). */
export const TocBase = Node.create({
  name: "tableOfContents",
  group: "block",
  atom: true,
  draggable: true,
  parseHTML() {
    return [{ tag: 'div[data-type="toc"]' }];
  },
  renderHTML() {
    return ["div", { "data-type": "toc", class: "nd-toc" }, "Tabla de contenidos"];
  },
});

/** Columnas: una fila de 2 a 5 columnas, cada una con bloques. */
export const ColumnListBase = Node.create({
  name: "columnList",
  group: "block",
  content: "column{2,5}",
  isolating: true,
  parseHTML() {
    return [{ tag: 'div[data-type="column-list"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "column-list", class: "nd-columns" }), 0];
  },
});
export const ColumnBase = Node.create({
  name: "column",
  content: "block+",
  isolating: true,
  parseHTML() {
    return [{ tag: 'div[data-type="column"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "column", class: "nd-column" }), 0];
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
    CalloutBase,
    ImageBlockBase,
    FileBlockBase,
    BookmarkBase,
    MathBlockBase,
    MathInlineBase,
    TocBase,
    ColumnListBase,
    ColumnBase,
    CommentMark,
    PersonMention,
  ];
}
