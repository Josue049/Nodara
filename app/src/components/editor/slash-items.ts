import type { Editor, Range } from "@tiptap/core";
import { dbApi } from "../database/api";
import { getPageId } from "./database-node";

export type SlashItem = {
  id: string;
  title: string;
  hint: string;
  keywords: string[];
  run: (editor: Editor, range: Range) => void;
};

const base = (editor: Editor, range: Range) => editor.chain().focus().deleteRange(range);

export const slashItems: SlashItem[] = [
  { id: "text", title: "Texto", hint: "Párrafo de texto normal", keywords: ["text", "texto", "parrafo", "p"],
    run: (e, r) => base(e, r).setParagraph().run() },
  { id: "h1", title: "Encabezado 1", hint: "Título de sección grande", keywords: ["h1", "heading", "encabezado", "titulo"],
    run: (e, r) => base(e, r).setHeading({ level: 1 }).run() },
  { id: "h2", title: "Encabezado 2", hint: "Título de sección mediano", keywords: ["h2", "heading", "encabezado", "titulo"],
    run: (e, r) => base(e, r).setHeading({ level: 2 }).run() },
  { id: "h3", title: "Encabezado 3", hint: "Título de sección pequeño", keywords: ["h3", "heading", "encabezado", "titulo"],
    run: (e, r) => base(e, r).setHeading({ level: 3 }).run() },
  { id: "bullet", title: "Lista con viñetas", hint: "Lista simple", keywords: ["ul", "bullet", "lista", "viñetas"],
    run: (e, r) => base(e, r).toggleBulletList().run() },
  { id: "number", title: "Lista numerada", hint: "Lista con numeración", keywords: ["ol", "number", "lista", "numerada"],
    run: (e, r) => base(e, r).toggleOrderedList().run() },
  { id: "todo", title: "Lista de tareas", hint: "Seguimiento con casillas", keywords: ["todo", "task", "tareas", "checkbox"],
    run: (e, r) => base(e, r).toggleTaskList().run() },
  { id: "toggle", title: "Lista desplegable", hint: "Oculta contenido dentro de un bloque", keywords: ["toggle", "details", "desplegable"],
    run: (e, r) => base(e, r).setDetails().run() },
  { id: "table", title: "Tabla", hint: "Tabla simple de 3×3", keywords: ["table", "tabla", "grid"],
    run: (e, r) => base(e, r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { id: "database", title: "Base de datos integrada", hint: "Inserta una tabla con vistas en esta página", keywords: ["database", "base", "datos", "tabla", "inline"],
    run: (e, r) => {
      const pageId = getPageId(e);
      if (!pageId) return;
      base(e, r).run();
      void dbApi.create({ hostPageId: pageId }).then((res) => e.chain().focus().insertContent({ type: "databaseBlock", attrs: { collectionId: res.collection.id } }).run());
    } },
  { id: "quote", title: "Cita", hint: "Captura una cita", keywords: ["quote", "cita", "blockquote"],
    run: (e, r) => base(e, r).toggleBlockquote().run() },
  { id: "code", title: "Código", hint: "Bloque de código", keywords: ["code", "codigo", "pre"],
    run: (e, r) => base(e, r).toggleCodeBlock().run() },
  { id: "divider", title: "Divisor", hint: "Separa visualmente el contenido", keywords: ["divider", "hr", "divisor", "linea"],
    run: (e, r) => base(e, r).setHorizontalRule().run() },
];

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function filterSlashItems(query: string): SlashItem[] {
  const q = norm(query.trim());
  if (!q) return slashItems;
  return slashItems.filter((i) => norm(i.title).includes(q) || i.keywords.some((k) => norm(k).startsWith(q)));
}
