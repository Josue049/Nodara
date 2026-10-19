/**
 * Modelo de bases de datos de Nodara (compartido por servidor y cliente).
 *
 * Una base (colección) NO es una tabla SQL propia: tiene propiedades (definiciones), registros y vistas.
 * Cada registro es una página (`pages` con `collection_id`) cuyos valores viven en `pages.properties`
 * indexados por id de propiedad; así cada fila puede abrirse como página con su propio contenido.
 */

export const PROPERTY_TYPES = [
  "text",
  "number",
  "select",
  "multi_select",
  "status",
  "date",
  "checkbox",
  "url",
  "email",
  "phone",
  "files",
  "relation",
  "rollup",
  "formula",
  "created_time",
  "last_edited_time",
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

/** Propiedades calculadas: no se escriben, se derivan al consultar. */
export const COMPUTED_TYPES: PropertyType[] = ["rollup", "formula", "created_time", "last_edited_time"];

export const TITLE_ID = "title";

export const OPTION_COLORS = ["default", "gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"] as const;
export type OptionColor = (typeof OPTION_COLORS)[number];

export type SelectOption = {
  id: string;
  name: string;
  color: OptionColor;
  /** Solo en «status»: grupo al que pertenece la opción. */
  group?: "todo" | "in_progress" | "done";
};

export type NumberFormat = "number" | "number_with_commas" | "percent" | "usd" | "eur";

export type RollupFn =
  | "count"
  | "count_values"
  | "count_unique"
  | "count_empty"
  | "count_not_empty"
  | "sum"
  | "average"
  | "median"
  | "min"
  | "max"
  | "range"
  | "show_original"
  | "percent_checked";

export type PropertyConfig = {
  options?: SelectOption[];
  format?: NumberFormat;
  includeTime?: boolean;
  /** relation */
  relationCollectionId?: string;
  reciprocalPropertyId?: string | null;
  /** rollup */
  rollupRelationId?: string;
  rollupTargetId?: string;
  rollupFn?: RollupFn;
  /** formula */
  expression?: string;
};

export type PropertyDef = {
  id: string;
  collectionId: string;
  name: string;
  type: PropertyType;
  config: PropertyConfig;
  position: number;
};

export type DateValue = { start: string; end?: string | null; time?: boolean };
export type FileValue = { name: string; url: string };
export type PropValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | DateValue
  | FileValue[];

// ── Filtros, orden, agrupación, cálculos ─────────────────────────────

export type FilterOperator =
  | "contains"
  | "not_contains"
  | "is"
  | "is_not"
  | "starts_with"
  | "ends_with"
  | "is_empty"
  | "is_not_empty"
  | "eq"
  | "neq"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "before"
  | "after"
  | "on_or_before"
  | "on_or_after";

export type FilterCondition = {
  propertyId: string;
  operator: FilterOperator;
  /** Texto/número/booleano/id de opción/fecha ISO. Para fechas relativas: "today" | "tomorrow" | "yesterday". */
  value?: string | number | boolean | null;
};
export type FilterGroup = { op: "and" | "or"; conditions: (FilterCondition | FilterGroup)[] };

export type SortRule = { propertyId: string; direction: "asc" | "desc" };

export type GroupConfig = { propertyId: string; hideEmpty?: boolean; hiddenGroups?: string[]; direction?: "asc" | "desc" };

export type CalcFn =
  | "none"
  | "count"
  | "count_values"
  | "count_unique"
  | "count_empty"
  | "count_not_empty"
  | "percent_empty"
  | "percent_not_empty"
  | "sum"
  | "average"
  | "median"
  | "min"
  | "max"
  | "range"
  | "checked"
  | "unchecked"
  | "percent_checked"
  | "earliest"
  | "latest";

export const VIEW_TYPES = ["table", "board", "list", "gallery", "calendar", "timeline"] as const;
export type ViewType = (typeof VIEW_TYPES)[number];

export type ViewConfig = {
  filter?: FilterGroup;
  sorts?: SortRule[];
  group?: GroupConfig | null;
  /** Ids de propiedad visibles, en orden. Si no existe, se muestran todas. El título siempre se muestra. */
  visibleProperties?: string[];
  calculations?: Record<string, CalcFn>;
  showVerticalLines?: boolean;
  showPageIcon?: boolean;
  wrapCells?: boolean;
  /** gallery */
  cardSize?: "small" | "medium" | "large";
  /** calendar / timeline: propiedad de fecha */
  dateProperty?: string;
  endDateProperty?: string | null;
  /** calendar: mes visible (YYYY-MM) no se persiste; solo la propiedad. */
  openPagesIn?: "side" | "center" | "full";
  /** Anchos de columna de la tabla (px) por propiedad. */
  columnWidths?: Record<string, number>;
};

export type ViewDef = {
  id: string;
  collectionId: string;
  name: string;
  type: ViewType;
  config: ViewConfig;
  position: number;
};

export type CollectionDef = {
  id: string;
  hostPageId: string;
  title: string;
  icon: string | null;
  isInline: boolean;
};

export type CollectionBundle = { collection: CollectionDef; properties: PropertyDef[]; views: ViewDef[] };

/** Fila lista para mostrar: valores almacenados + calculados. */
export type RecordRow = {
  id: string;
  title: string;
  icon: string | null;
  createdAt: string;
  updatedAt: string;
  values: Record<string, PropValue | CalcValue>;
};

/** Valor calculado (fórmula/rollup). Las fechas se representan como DateValue; las listas como array. */
export type CalcValue = string | number | boolean | null | string[] | number[] | DateValue;

export type QueryResult = {
  rows: RecordRow[];
  /** Presente cuando la vista agrupa. */
  groups?: { key: string; label: string; color?: OptionColor; rowIds: string[] }[];
  calculations: Record<string, number | string | null>;
  total: number;
  /** Páginas referenciadas por propiedades de relación: id → título e icono. */
  refs?: Record<string, { title: string; icon: string | null }>;
};

export type TemplateDef = {
  id: string;
  collectionId: string;
  name: string;
  title: string;
  properties: Record<string, PropValue>;
  content: unknown;
};
