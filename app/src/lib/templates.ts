/** Plantillas de página integradas (contenido propio de Nodara; no copiadas de Notion). */
import type { DocNode } from "./export/markdown";

const t = (text: string): DocNode => ({ type: "text", text });
const p = (text = ""): DocNode => (text ? { type: "paragraph", content: [t(text)] } : { type: "paragraph" });
const h = (level: 1 | 2 | 3, text: string): DocNode => ({ type: "heading", attrs: { level }, content: [t(text)] });
const bullets = (...items: string[]): DocNode => ({ type: "bulletList", content: items.map((i) => ({ type: "listItem", content: [p(i)] })) });
const todos = (...items: string[]): DocNode => ({ type: "taskList", content: items.map((i) => ({ type: "taskItem", attrs: { checked: false }, content: [p(i)] })) });
const callout = (icon: string, color: string, text: string): DocNode => ({ type: "callout", attrs: { icon, color }, content: [p(text)] });
const columns = (...cols: DocNode[][]): DocNode => ({ type: "columnList", content: cols.map((content) => ({ type: "column", content })) });
const doc = (...content: DocNode[]): DocNode => ({ type: "doc", content });

export type BuiltinTemplate = { key: string; name: string; description: string; icon: string; title: string; content: DocNode };

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    key: "meeting-notes",
    name: "Notas de reunión",
    description: "Agenda, decisiones y tareas con responsables",
    icon: "📝",
    title: "Notas de reunión",
    content: doc(
      callout("📅", "blue", "Fecha, asistentes y objetivo de la reunión."),
      h(2, "Agenda"),
      bullets("Tema 1", "Tema 2", "Tema 3"),
      h(2, "Notas"),
      p(),
      h(2, "Decisiones"),
      bullets("Decisión y motivo"),
      h(2, "Tareas"),
      todos("Tarea — responsable — fecha"),
    ),
  },
  {
    key: "project-plan",
    name: "Plan de proyecto",
    description: "Objetivo, alcance, hitos y riesgos",
    icon: "🚀",
    title: "Plan de proyecto",
    content: doc(
      { type: "tableOfContents" },
      h(1, "Objetivo"),
      p("¿Qué problema resuelve este proyecto y cómo sabremos que lo logramos?"),
      h(1, "Alcance"),
      columns([h(3, "Incluye"), bullets("…")], [h(3, "No incluye"), bullets("…")]),
      h(1, "Hitos"),
      todos("Hito 1", "Hito 2", "Hito 3"),
      h(1, "Riesgos"),
      callout("⚠️", "yellow", "Anota aquí los riesgos y cómo se mitigarán."),
    ),
  },
  {
    key: "weekly-planner",
    name: "Planificador semanal",
    description: "Prioridades y tareas por día",
    icon: "🗓️",
    title: "Semana del …",
    content: doc(
      h(2, "Prioridades de la semana"),
      todos("Prioridad 1", "Prioridad 2", "Prioridad 3"),
      columns([h(3, "Lunes"), todos("…")], [h(3, "Martes"), todos("…")], [h(3, "Miércoles"), todos("…")]),
      columns([h(3, "Jueves"), todos("…")], [h(3, "Viernes"), todos("…")], [h(3, "Fin de semana"), todos("…")]),
    ),
  },
  {
    key: "journal",
    name: "Diario",
    description: "Reflexión diaria con gratitud y aprendizajes",
    icon: "📔",
    title: "Diario",
    content: doc(h(2, "Hoy me siento…"), p(), h(2, "Agradezco"), bullets("…"), h(2, "Aprendí"), p(), h(2, "Mañana"), todos("…")),
  },
  {
    key: "requirements",
    name: "Documento de requisitos",
    description: "Contexto, requisitos y criterios de aceptación",
    icon: "📋",
    title: "Documento de requisitos",
    content: doc(
      { type: "tableOfContents" },
      h(1, "Contexto"),
      p(),
      h(1, "Requisitos"),
      bullets("Requisito funcional 1", "Requisito no funcional 1"),
      h(1, "Criterios de aceptación"),
      todos("Criterio 1", "Criterio 2"),
      h(1, "Preguntas abiertas"),
      callout("❓", "purple", "Lo que todavía no sabemos."),
    ),
  },
  {
    key: "wiki",
    name: "Guía o wiki",
    description: "Página de referencia con secciones desplegables",
    icon: "📚",
    title: "Guía",
    content: doc(
      callout("📚", "gray", "Resumen de una línea de qué contiene esta guía."),
      h(2, "Primeros pasos"),
      { type: "orderedList", content: [1, 2, 3].map((n) => ({ type: "listItem", content: [p(`Paso ${n}`)] })) },
      h(2, "Preguntas frecuentes"),
      { type: "details", attrs: { open: false }, content: [{ type: "detailsSummary", content: [t("¿Pregunta?")] }, { type: "detailsContent", content: [p("Respuesta.")] }] },
    ),
  },
];
