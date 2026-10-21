import type { CalcFn, DateValue, NumberFormat, OptionColor, PropertyDef, PropertyType, RollupFn, SelectOption } from "./types";

const usd = new Intl.NumberFormat("es-ES", { style: "currency", currency: "USD" });
const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const plain = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 10, useGrouping: false });
const commas = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 10, useGrouping: true });

export function formatNumber(n: number | null | undefined, format: NumberFormat = "number"): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "";
  switch (format) {
    case "usd":
      return usd.format(n);
    case "eur":
      return eur.format(n);
    case "percent":
      return `${commas.format(n * 100)} %`;
    case "number_with_commas":
      return commas.format(n);
    default:
      return plain.format(n);
  }
}

const dateFmt = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const timeFmt = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

export function formatDate(v: DateValue | null | undefined): string {
  if (!v?.start) return "";
  const one = (iso: string) => {
    const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
    return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d) + (v.time ? ` ${timeFmt.format(d)}` : "");
  };
  return v.end ? `${one(v.start)} → ${one(v.end)}` : one(v.start);
}

export const TYPE_LABELS: Record<PropertyType, string> = {
  text: "Texto",
  number: "Número",
  select: "Seleccionar",
  multi_select: "Selección múltiple",
  status: "Estado",
  date: "Fecha",
  person: "Persona",
  checkbox: "Casilla",
  url: "URL",
  email: "Correo electrónico",
  phone: "Teléfono",
  files: "Archivos y multimedia",
  relation: "Relación",
  rollup: "Rollup",
  formula: "Fórmula",
  created_time: "Fecha de creación",
  created_by: "Creado por",
  last_edited_time: "Última edición",
};

export const VIEW_LABELS = { table: "Tabla", board: "Tablero", list: "Lista", gallery: "Galería", calendar: "Calendario", timeline: "Cronograma" } as const;

export const ROLLUP_LABELS: Record<RollupFn, string> = {
  count: "Contar todo",
  count_values: "Contar valores",
  count_unique: "Contar valores únicos",
  count_empty: "Contar vacíos",
  count_not_empty: "Contar no vacíos",
  sum: "Suma",
  average: "Promedio",
  median: "Mediana",
  min: "Mínimo",
  max: "Máximo",
  range: "Rango",
  show_original: "Mostrar original",
  percent_checked: "Porcentaje marcado",
};

export const CALC_LABELS: Record<CalcFn, string> = {
  none: "Ninguno",
  count: "Contar todo",
  count_values: "Contar valores",
  count_unique: "Contar únicos",
  count_empty: "Contar vacíos",
  count_not_empty: "Contar no vacíos",
  percent_empty: "% vacíos",
  percent_not_empty: "% no vacíos",
  sum: "Suma",
  average: "Promedio",
  median: "Mediana",
  min: "Mínimo",
  max: "Máximo",
  range: "Rango",
  checked: "Marcados",
  unchecked: "Sin marcar",
  percent_checked: "% marcados",
  earliest: "Fecha más antigua",
  latest: "Fecha más reciente",
};

/** Funciones de cálculo disponibles según el tipo de columna. */
export function calcOptionsFor(p: PropertyDef | null): CalcFn[] {
  const base: CalcFn[] = ["none", "count", "count_values", "count_unique", "count_empty", "count_not_empty", "percent_empty", "percent_not_empty"];
  if (!p) return base;
  if (p.type === "number" || p.type === "formula" || p.type === "rollup") return [...base, "sum", "average", "median", "min", "max", "range"];
  if (p.type === "checkbox") return ["none", "count", "checked", "unchecked", "percent_checked"];
  if (p.type === "date" || p.type === "created_time" || p.type === "last_edited_time") return [...base, "earliest", "latest"];
  return base;
}

export function formatCalc(fn: CalcFn, v: number | string | null, p: PropertyDef | null): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return fn === "earliest" || fn === "latest" ? formatDate({ start: v }) : v;
  if (fn.startsWith("percent")) return `${Math.round(v * 10) / 10} %`;
  if (["sum", "average", "median", "min", "max", "range"].includes(fn)) return formatNumber(v, p?.type === "number" ? p.config.format : "number_with_commas");
  return String(v);
}

export const optionById = (p: PropertyDef, id: unknown): SelectOption | undefined => (p.config.options ?? []).find((o) => o.id === id);

/** Colores de etiqueta. El tema oscuro se resuelve con variables CSS. */
export const tagVar = (c: OptionColor) => ({ background: `var(--opt-${c}-bg)`, color: `var(--opt-${c}-fg)` });
