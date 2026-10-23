// Operaciones sobre un bloque (convertir, color, duplicar, eliminar, contar), compartidas por el menú «/»,
// el menú del asa de bloque y el menú de formato.
import type { ChainedCommands, Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { ChevronRight, Code, Heading1, Heading2, Heading3, Heading4, Lightbulb, List, ListOrdered, ListTodo, Quote, Type, type LucideIcon } from "lucide-react";
import type { Swatch } from "./colors";

export type TurnInto = { id: string; label: string; run: (e: Editor) => void };

/** «Convertir en»: actúa sobre el bloque de la selección actual y conserva su texto. */
export const TURN_INTO: TurnInto[] = [
  { id: "text", label: "Texto", run: (e) => e.chain().focus().clearNodes().run() },
  { id: "h1", label: "Encabezado 1", run: (e) => e.chain().focus().clearNodes().setHeading({ level: 1 }).run() },
  { id: "h2", label: "Encabezado 2", run: (e) => e.chain().focus().clearNodes().setHeading({ level: 2 }).run() },
  { id: "h3", label: "Encabezado 3", run: (e) => e.chain().focus().clearNodes().setHeading({ level: 3 }).run() },
  { id: "h4", label: "Encabezado 4", run: (e) => e.chain().focus().clearNodes().setHeading({ level: 4 }).run() },
  { id: "bullet", label: "Lista con viñetas", run: (e) => e.chain().focus().clearNodes().toggleBulletList().run() },
  { id: "number", label: "Lista numerada", run: (e) => e.chain().focus().clearNodes().toggleOrderedList().run() },
  { id: "todo", label: "Lista de tareas", run: (e) => e.chain().focus().clearNodes().toggleTaskList().run() },
  { id: "toggle", label: "Lista desplegable", run: (e) => e.chain().focus().clearNodes().setDetails().run() },
  { id: "code", label: "Código", run: (e) => e.chain().focus().clearNodes().toggleCodeBlock().run() },
  { id: "quote", label: "Cita", run: (e) => e.chain().focus().clearNodes().toggleBlockquote().run() },
  { id: "callout", label: "Llamada", run: (e) => turnIntoCallout(e) },
];

/** Icono de cada tipo de «Convertir en». */
export const TURN_ICONS: Record<string, LucideIcon> = { text: Type, h1: Heading1, h2: Heading2, h3: Heading3, h4: Heading4, bullet: List, number: ListOrdered, todo: ListTodo, toggle: ChevronRight, code: Code, quote: Quote, callout: Lightbulb };

/** Envuelve el texto del bloque actual en una llamada («Convertir en › Llamada»). */
function turnIntoCallout(e: Editor) {
  e.chain().focus().clearNodes().run();
  const { $from } = e.state.selection;
  const block = $from.node($from.depth);
  const pos = $from.before($from.depth);
  e.chain()
    .insertContentAt({ from: pos, to: pos + block.nodeSize }, { type: "callout", attrs: { icon: "💡", color: "gray" }, content: [block.toJSON()] })
    .run();
}

export function currentBlockId(e: Editor): string {
  if (e.isActive("codeBlock")) return "code";
  for (const l of [1, 2, 3, 4]) if (e.isActive("heading", { level: l })) return `h${l}`;
  if (e.isActive("taskList")) return "todo";
  if (e.isActive("bulletList")) return "bullet";
  if (e.isActive("orderedList")) return "number";
  if (e.isActive("details")) return "toggle";
  if (e.isActive("callout")) return "callout";
  if (e.isActive("blockquote")) return "quote";
  return "text";
}

export function currentBlockLabel(e: Editor): string {
  return TURN_INTO.find((i) => i.id === currentBlockId(e))?.label ?? "Texto";
}

const NODE_LABELS: Record<string, string> = {
  paragraph: "Texto",
  bulletList: "Lista con viñetas",
  orderedList: "Lista numerada",
  taskList: "Lista de tareas",
  details: "Lista desplegable",
  blockquote: "Cita",
  codeBlock: "Código",
  callout: "Llamada",
  table: "Tabla",
  horizontalRule: "Divisor",
  imageBlock: "Imagen",
  videoBlock: "Vídeo",
  audioBlock: "Audio",
  fileBlock: "Archivo",
  bookmark: "Marcador web",
  mathBlock: "Ecuación en bloque",
  tableOfContents: "Tabla de contenidos",
  columnList: "Columnas",
  databaseBlock: "Base de datos",
  pageLink: "Página",
  breadcrumb: "Ruta de navegación",
};

/** Nombre del tipo de un bloque (cabecera del menú del asa). */
export function blockTypeLabel(node: PMNode): string {
  if (node.type.name === "heading") return `Encabezado ${node.attrs.level}`;
  return NODE_LABELS[node.type.name] ?? "Bloque";
}

/** Id de «Convertir en» que corresponde a un bloque (para marcar el tipo actual). */
export function blockIdOfNode(node: PMNode): string | null {
  const map: Record<string, string> = { paragraph: "text", bulletList: "bullet", orderedList: "number", taskList: "todo", details: "toggle", callout: "callout", blockquote: "quote", codeBlock: "code" };
  return node.type.name === "heading" ? `h${node.attrs.level}` : (map[node.type.name] ?? null);
}

/** Bloques que se pueden «convertir» (contienen texto en línea). */
export const isConvertible = (node: PMNode) => ["paragraph", "heading", "bulletList", "orderedList", "taskList", "blockquote", "codeBlock", "details", "callout"].includes(node.type.name);

/** Coloca el cursor al final del texto del bloque que empieza en `pos`. */
export function focusBlock(e: Editor, pos: number) {
  const node = e.state.doc.nodeAt(pos);
  if (!node) return;
  let target = pos + 1;
  node.descendants((child, offset) => {
    if (child.isTextblock) target = pos + 1 + offset + 1 + child.content.size;
    return true;
  });
  e.chain().focus().setTextSelection(Math.min(target, e.state.doc.content.size)).run();
}

export function duplicateBlock(e: Editor, pos: number) {
  const node = e.state.doc.nodeAt(pos);
  if (node) e.chain().focus().insertContentAt(pos + node.nodeSize, node.toJSON()).run();
}

export function deleteBlock(e: Editor, pos: number) {
  const node = e.state.doc.nodeAt(pos);
  if (node) e.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
}

export type ColorKind = "text" | "bg";

/**
 * Aplica un color a la selección de la cadena. Texto y fondo se excluyen: elegir uno quita el otro,
 * y «Predeterminado» (sin valor) deja el texto sin color de ningún tipo.
 */
export function withColor(chain: ChainedCommands, kind: ColorKind, swatch: Swatch): ChainedCommands {
  const value = kind === "text" ? swatch.text : swatch.bg;
  if (!value) return chain.unsetColor().unsetHighlight();
  return kind === "text" ? chain.unsetHighlight().setColor(value) : chain.unsetColor().setHighlight({ color: value });
}

/** Aplica color de texto o de fondo a todo el texto del bloque («Color» del bloque). */
export function colorBlock(e: Editor, pos: number, kind: ColorKind, swatch: Swatch) {
  const node = e.state.doc.nodeAt(pos);
  if (!node) return;
  const from = pos + 1;
  const to = pos + node.nodeSize - 1;
  const chain = e.chain().focus().command(({ tr }) => {
    tr.setSelection(TextSelection.create(tr.doc, from, to));
    return true;
  });
  withColor(chain, kind, swatch).run();
  rememberColor(kind, swatch);
  e.commands.setTextSelection(to);
}

const RECENT_KEY = "nodara:recent-colors";
export type RecentColor = { kind: ColorKind; id: string };

/** Últimos colores usados (preferencia local del navegador), del más reciente al más antiguo. */
export function recentColors(): RecentColor[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((r) => (r?.kind === "text" || r?.kind === "bg") && typeof r.id === "string").slice(0, 5) : [];
  } catch {
    return [];
  }
}

export function rememberColor(kind: ColorKind, swatch: Swatch) {
  if (swatch.id === "default") return;
  try {
    const next = [{ kind, id: swatch.id }, ...recentColors().filter((r) => !(r.kind === kind && r.id === swatch.id))].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}

/** Recuento de palabras y caracteres del texto de un bloque. */
export function countText(text: string): { words: number; chars: number } {
  const trimmed = text.trim();
  return { words: trimmed ? trimmed.split(/\s+/u).length : 0, chars: text.length };
}
