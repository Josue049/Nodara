import type { ChainedCommands, Editor, Range } from "@tiptap/core";
import {
  AtSign,
  AudioLines,
  Bookmark,
  Calendar,
  ChartGantt,
  ChevronRight,
  Code,
  Columns2,
  Columns3,
  Columns4,
  Copy,
  Database,
  File,
  FileSymlink,
  FileText,
  Footprints,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Image,
  Kanban,
  LayoutGrid,
  Lightbulb,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Quote,
  Rows3,
  Sigma,
  Smile,
  SquareFunction,
  Table,
  Table2,
  TableOfContents,
  Trash2,
  Type,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { ViewType } from "@/lib/collections/types";
import { dbApi } from "../database/api";
import { colorBlock, deleteBlock, duplicateBlock, TURN_ICONS, TURN_INTO } from "./block-actions";
import { SWATCHES } from "./colors";
import { getPageId } from "./database-node";

/** Lo que el menú necesita de la aplicación (crear páginas, navegar, abrir el selector de emoji). */
export type SlashContext = {
  createPage: (parentId: string) => Promise<{ id: string; title: string; icon: string | null }>;
  createDatabase: (parentId: string) => Promise<{ id: string; title: string; icon: string | null }>;
  navigate: (pageId: string) => void;
  openEmoji: (at: { x: number; y: number }, insert: (emoji: string) => void) => void;
};

export type SectionId = "suggested" | "basic" | "media" | "database" | "advanced" | "inline" | "turn" | "actions" | "textColor" | "bgColor";

/** Secciones en el orden observado en Notion (2026-10-20). */
export const SECTIONS: Record<SectionId, string> = {
  suggested: "Sugeridos",
  basic: "Bloques básicos",
  media: "Multimedia",
  database: "Base de datos",
  advanced: "Bloques avanzados",
  inline: "En línea",
  turn: "Convertir en",
  actions: "Acciones",
  textColor: "Color del texto",
  bgColor: "Color de fondo",
};
const ORDER = Object.keys(SECTIONS) as SectionId[];

/** Icono: componente de lucide o muestra de color (secciones de color). */
export type SlashIcon = LucideIcon | { swatch: string | null; kind: "text" | "bg" };

export type SlashItem = {
  id: string;
  title: string;
  section: Exclude<SectionId, "suggested">;
  icon: SlashIcon;
  /** Atajo Markdown que también crea el bloque en Nodara (columna derecha, como en Notion). */
  hint?: string;
  keywords: string[];
  run: (editor: Editor, range: Range, ctx: SlashContext | null) => void;
};

/** Entrada del menú: un elemento dentro de una sección (un mismo elemento puede aparecer en «Sugeridos» y en su sección). */
export type SlashEntry = { key: string; section: SectionId; item: SlashItem };

// ── Inserción con la semántica de Notion: en un bloque vacío lo convierte; si tiene texto, crea el bloque debajo ──
function place(e: Editor, r: Range, apply: (c: ChainedCommands) => ChainedCommands) {
  e.chain().focus().deleteRange(r).run();
  const { $from } = e.state.selection;
  if ($from.parent.isTextblock && $from.parent.content.size > 0) {
    const after = $from.after($from.depth);
    e.chain().insertContentAt(after, { type: "paragraph" }).setTextSelection(after + 1).run();
  }
  apply(e.chain().focus()).run();
}
const insert = (content: object | object[]) => (e: Editor, r: Range) => place(e, r, (c) => c.insertContent(content));
/** Bloque de nivel superior en el cursor (para acciones y colores sobre «el bloque actual»). */
const blockAt = (e: Editor) => e.state.selection.$from.before(Math.max(1, e.state.selection.$from.depth));
const topAt = (e: Editor) => e.state.selection.$from.before(1);

const columns = (n: number) => ({ type: "columnList", content: Array.from({ length: n }, () => ({ type: "column", content: [{ type: "paragraph" }] })) });

function insertDatabase(view: ViewType | null) {
  return (e: Editor, r: Range) => {
    const pageId = getPageId(e);
    if (!pageId) return;
    place(e, r, (c) => c);
    void dbApi.create({ hostPageId: pageId }).then(async (res) => {
      const first = res.views[0];
      if (view && first && first.type !== view) await dbApi.updateView(first.id, { type: view, name: VIEW_NAMES[view] });
      e.chain().focus().insertContent({ type: "databaseBlock", attrs: { collectionId: res.collection.id } }).run();
    });
  };
}
const VIEW_NAMES: Record<ViewType, string> = { table: "Tabla", board: "Tablero", gallery: "Galería", list: "Lista", calendar: "Calendario", timeline: "Cronograma" };

function linkNewPage(make: (ctx: SlashContext, parent: string) => Promise<{ id: string; title: string; icon: string | null }>, open: boolean) {
  return (e: Editor, r: Range, ctx: SlashContext | null) => {
    const parent = getPageId(e);
    if (!ctx || !parent) return;
    place(e, r, (c) => c);
    void make(ctx, parent).then((p) => {
      e.chain().focus().insertContent({ type: "pageLink", attrs: { pageId: p.id, title: p.title, icon: p.icon } }).run();
      if (open) ctx.navigate(p.id);
    });
  };
}

const COLOR_EN: Record<string, string> = { Predeterminado: "default", Gris: "gray", Marrón: "brown", Naranja: "orange", Amarillo: "yellow", Verde: "green", Azul: "blue", Morado: "purple", Rosa: "pink", Rojo: "red" };

const TURN_KEYWORDS: Record<string, string[]> = { text: ["text"], h1: ["h1", "heading"], h2: ["h2", "heading"], h3: ["h3", "heading"], h4: ["h4", "heading"], bullet: ["bullet", "lista"], number: ["numbered", "lista"], todo: ["todo", "lista"], toggle: ["toggle", "lista"], code: ["code"], quote: ["quote"], callout: ["callout"] };

export const slashItems: SlashItem[] = [
  // Bloques básicos
  { id: "text", section: "basic", title: "Texto", icon: Type, keywords: ["text", "texto", "parrafo", "plain", "p"], run: (e, r) => place(e, r, (c) => c.setParagraph()) },
  { id: "h1", section: "basic", title: "Encabezado 1", icon: Heading1, hint: "#", keywords: ["h1", "heading 1", "encabezado", "titulo", "#"], run: (e, r) => place(e, r, (c) => c.setHeading({ level: 1 })) },
  { id: "h2", section: "basic", title: "Encabezado 2", icon: Heading2, hint: "##", keywords: ["h2", "heading 2", "encabezado", "titulo", "##"], run: (e, r) => place(e, r, (c) => c.setHeading({ level: 2 })) },
  { id: "h3", section: "basic", title: "Encabezado 3", icon: Heading3, hint: "###", keywords: ["h3", "heading 3", "encabezado", "titulo", "###"], run: (e, r) => place(e, r, (c) => c.setHeading({ level: 3 })) },
  { id: "h4", section: "basic", title: "Encabezado 4", icon: Heading4, hint: "####", keywords: ["h4", "heading 4", "encabezado", "titulo", "####"], run: (e, r) => place(e, r, (c) => c.setHeading({ level: 4 })) },
  { id: "bullet", section: "basic", title: "Lista con viñetas", icon: List, hint: "-", keywords: ["ul", "bullet", "bulleted list", "lista", "viñetas"], run: (e, r) => place(e, r, (c) => c.toggleBulletList()) },
  { id: "number", section: "basic", title: "Lista numerada", icon: ListOrdered, hint: "1.", keywords: ["ol", "number", "numbered list", "lista", "numerada"], run: (e, r) => place(e, r, (c) => c.toggleOrderedList()) },
  { id: "todo", section: "basic", title: "Lista de tareas", icon: ListTodo, hint: "[]", keywords: ["todo", "to-do", "task", "tareas", "checkbox", "lista"], run: (e, r) => place(e, r, (c) => c.toggleTaskList()) },
  { id: "toggle", section: "basic", title: "Lista desplegable", icon: ChevronRight, keywords: ["toggle", "toggle list", "details", "desplegable", "lista"], run: (e, r) => place(e, r, (c) => c.setDetails()) },
  { id: "page", section: "basic", title: "Página", icon: FileText, keywords: ["page", "pagina", "subpagina", "subpage"], run: linkNewPage((ctx, parent) => ctx.createPage(parent), true) },
  { id: "callout", section: "basic", title: "Llamada", icon: Lightbulb, keywords: ["callout", "llamada", "aviso", "nota", "destacado"], run: insert({ type: "callout", attrs: { icon: "💡", color: "gray" }, content: [{ type: "paragraph" }] }) },
  { id: "quote", section: "basic", title: "Cita", icon: Quote, hint: ">", keywords: ["quote", "cita", "blockquote"], run: (e, r) => place(e, r, (c) => c.toggleBlockquote()) },
  { id: "table", section: "basic", title: "Tabla", icon: Table, keywords: ["table", "tabla", "grid", "simple table"], run: (e, r) => place(e, r, (c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true })) },
  { id: "divider", section: "basic", title: "Divisor", icon: Minus, hint: "---", keywords: ["divider", "hr", "divisor", "linea", "separador", "div"], run: (e, r) => place(e, r, (c) => c.setHorizontalRule()) },
  { id: "link-page", section: "basic", title: "Enlace a página", icon: FileSymlink, keywords: ["link to page", "enlace", "pagina", "link"], run: insert({ type: "pageLink" }) },
  // Multimedia
  { id: "image", section: "media", title: "Imagen", icon: Image, keywords: ["image", "imagen", "foto", "img", "picture"], run: insert({ type: "imageBlock" }) },
  { id: "video", section: "media", title: "Vídeo", icon: Video, keywords: ["video", "vídeo", "pelicula", "mp4"], run: insert({ type: "videoBlock" }) },
  { id: "audio", section: "media", title: "Audio", icon: AudioLines, keywords: ["audio", "sonido", "musica", "mp3"], run: insert({ type: "audioBlock" }) },
  { id: "code", section: "media", title: "Código", icon: Code, hint: "```", keywords: ["code", "codigo", "pre", "snippet"], run: (e, r) => place(e, r, (c) => c.toggleCodeBlock()) },
  { id: "file", section: "media", title: "Archivo", icon: File, keywords: ["file", "archivo", "adjunto", "pdf", "documento"], run: insert({ type: "fileBlock" }) },
  { id: "bookmark", section: "media", title: "Marcador web", icon: Bookmark, keywords: ["bookmark", "web bookmark", "marcador", "enlace", "link", "url", "web"], run: insert({ type: "bookmark" }) },
  // Base de datos
  { id: "db-table", section: "database", title: "Vista de tabla", icon: Table2, keywords: ["table view", "tabla", "base de datos", "database"], run: insertDatabase("table") },
  { id: "db-board", section: "database", title: "Vista de tablero", icon: Kanban, keywords: ["board view", "tablero", "kanban", "base de datos", "database"], run: insertDatabase("board") },
  { id: "db-gallery", section: "database", title: "Vista de galería", icon: LayoutGrid, keywords: ["gallery view", "galeria", "base de datos", "database"], run: insertDatabase("gallery") },
  { id: "db-list", section: "database", title: "Vista de lista", icon: Rows3, keywords: ["list view", "lista", "base de datos", "database"], run: insertDatabase("list") },
  { id: "db-calendar", section: "database", title: "Vista de calendario", icon: Calendar, keywords: ["calendar view", "calendario", "base de datos", "database"], run: insertDatabase("calendar") },
  { id: "db-timeline", section: "database", title: "Vista de cronograma", icon: ChartGantt, keywords: ["timeline view", "cronograma", "gantt", "base de datos", "database"], run: insertDatabase("timeline") },
  { id: "database", section: "database", title: "Base de datos integrada", icon: Database, keywords: ["database inline", "inline", "base", "datos", "tabla"], run: insertDatabase(null) },
  { id: "database-page", section: "database", title: "Base de datos de página completa", icon: Database, keywords: ["database full page", "full page", "base", "datos", "pagina completa"], run: linkNewPage((ctx, parent) => ctx.createDatabase(parent), true) },
  // Bloques avanzados
  { id: "toc", section: "advanced", title: "Tabla de contenidos", icon: TableOfContents, keywords: ["toc", "table of contents", "indice", "contenidos"], run: insert({ type: "tableOfContents" }) },
  { id: "math", section: "advanced", title: "Ecuación en bloque", icon: SquareFunction, keywords: ["math", "block equation", "ecuacion", "formula", "latex", "katex"], run: insert({ type: "mathBlock" }) },
  { id: "breadcrumb", section: "advanced", title: "Ruta de navegación", icon: Footprints, keywords: ["breadcrumb", "bread", "ruta", "migas"], run: insert({ type: "breadcrumb" }) },
  { id: "columns2", section: "advanced", title: "2 columnas", icon: Columns2, keywords: ["columns", "columnas", "2", "dos"], run: insert(columns(2)) },
  { id: "columns3", section: "advanced", title: "3 columnas", icon: Columns3, keywords: ["columns", "columnas", "3", "tres"], run: insert(columns(3)) },
  { id: "columns4", section: "advanced", title: "4 columnas", icon: Columns4, keywords: ["columns", "columnas", "4", "cuatro"], run: insert(columns(4)) },
  { id: "columns5", section: "advanced", title: "5 columnas", icon: Columns4, keywords: ["columns", "columnas", "5", "cinco"], run: insert(columns(5)) },
  // En línea
  { id: "mention", section: "inline", title: "Mencionar a una persona", icon: AtSign, keywords: ["mention", "person", "mencionar", "persona", "@"], run: (e, r) => e.chain().focus().deleteRange(r).insertContent("@").run() },
  { id: "emoji", section: "inline", title: "Emoji", icon: Smile, keywords: ["emoji", "emoticono", "icono"], run: (e, r, ctx) => {
      e.chain().focus().deleteRange(r).run();
      const at = e.view.coordsAtPos(e.state.selection.from);
      ctx?.openEmoji({ x: at.left, y: at.bottom }, (emoji) => e.chain().focus().insertContent(emoji).run());
    } },
  { id: "math-inline", section: "inline", title: "Ecuación en línea", icon: Sigma, keywords: ["inline equation", "ecuacion", "latex", "formula", "$"], run: (e, r) => e.chain().focus().deleteRange(r).insertContent({ type: "mathInline" }).run() },
  // Convertir en (el bloque actual, conservando su texto)
  ...TURN_INTO.map((t): SlashItem => ({
    id: `turn-${t.id}`,
    section: "turn",
    title: t.label,
    icon: TURN_ICONS[t.id] ?? Type,
    keywords: ["turn", "turn into", "convertir", ...(TURN_KEYWORDS[t.id] ?? [])],
    run: (e, r) => {
      e.chain().focus().deleteRange(r).run();
      t.run(e);
    },
  })),
  // Acciones sobre el bloque actual
  { id: "duplicate", section: "actions", title: "Duplicar", icon: Copy, keywords: ["duplicate", "duplicar", "copiar"], run: (e, r) => (e.chain().focus().deleteRange(r).run(), duplicateBlock(e, topAt(e))) },
  { id: "delete", section: "actions", title: "Eliminar", icon: Trash2, keywords: ["delete", "eliminar", "borrar", "quitar"], run: (e, r) => (e.chain().focus().deleteRange(r).run(), deleteBlock(e, topAt(e))) },
  // Colores del bloque actual
  ...SWATCHES.map((s): SlashItem => ({
    id: `color-${COLOR_EN[s.name]}`,
    section: "textColor",
    title: s.text ? `Texto ${s.name.toLowerCase()}` : "Texto predeterminado",
    icon: { swatch: s.text, kind: "text" },
    keywords: ["color", COLOR_EN[s.name], s.name, "texto", "text"],
    run: (e, r) => (e.chain().focus().deleteRange(r).run(), colorBlock(e, blockAt(e), "text", s)),
  })),
  ...SWATCHES.map((s): SlashItem => ({
    id: `bg-${COLOR_EN[s.name]}`,
    section: "bgColor",
    title: s.bg ? `Fondo ${s.name.toLowerCase()}` : "Fondo predeterminado",
    icon: { swatch: s.bg, kind: "bg" },
    keywords: ["background", "fondo", "color", COLOR_EN[s.name], s.name],
    run: (e, r) => (e.chain().focus().deleteRange(r).run(), colorBlock(e, blockAt(e), "bg", s)),
  })),
];

const DEFAULT_SUGGESTED = ["todo", "h1", "page"];
const RECENT_KEY = "nodara:slash-recent";

/** Bloques usados recientemente (preferencia local del navegador, como «Sugeridos» en Notion). */
export function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
export function rememberUse(id: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...readRecent().filter((x) => x !== id)].slice(0, 3)));
  } catch {}
}

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Puntuación de coincidencia (menor es mejor) o null si no coincide. */
function score(item: SlashItem, q: string): number | null {
  const title = norm(item.title);
  if (title === q) return 0;
  if (title.startsWith(q)) return 1;
  if (title.split(/\s+/).some((w) => w.startsWith(q))) return 2;
  if (item.keywords.some((k) => norm(k).startsWith(q))) return 3;
  if (title.includes(q)) return 4;
  return null;
}

/**
 * Sin texto: todas las secciones en orden, con «Sugeridos» (recientes o, si no hay, unos por defecto) al principio.
 * Con texto: una sola sección de resultados ordenada por relevancia (como «Filtered results» en Notion).
 */
export function filterSlashItems(query: string, recent: string[] = []): SlashEntry[] {
  const q = norm(query.trim());
  if (!q) {
    const byId = new Map(slashItems.map((i) => [i.id, i]));
    const suggested = (recent.length ? recent : DEFAULT_SUGGESTED).map((id) => byId.get(id)).filter((i): i is SlashItem => !!i);
    return [
      ...suggested.map((item) => ({ key: `suggested-${item.id}`, section: "suggested" as const, item })),
      ...ORDER.filter((s) => s !== "suggested").flatMap((s) => slashItems.filter((i) => i.section === s).map((item) => ({ key: item.id, section: s, item }))),
    ];
  }
  return slashItems
    .map((item, i) => ({ item, i, s: score(item, q) }))
    .filter((x) => x.s !== null)
    .sort((a, b) => (a.s! - b.s!) || ORDER.indexOf(a.item.section) - ORDER.indexOf(b.item.section) || a.i - b.i)
    .map(({ item }) => ({ key: item.id, section: item.section, item }));
}

/** Rótulo secundario en los resultados filtrados (Notion: «Heading 2 · Turn into»). */
export const filteredSub = (item: SlashItem): string | null => (["turn", "actions", "textColor", "bgColor"].includes(item.section) ? SECTIONS[item.section] : null);
