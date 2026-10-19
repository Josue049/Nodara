/**
 * Motor de consulta de bases de datos: valores calculados (fórmulas, rollups), filtros, orden,
 * agrupación, búsqueda y cálculos de columna. Funciones puras, sin acceso a la base.
 */
import { evaluateFormula, FormulaError, type FValue } from "./formula";
import {
  COMPUTED_TYPES,
  TITLE_ID,
  type CalcFn,
  type CalcValue,
  type DateValue,
  type FilterCondition,
  type FilterGroup,
  type GroupConfig,
  type PropertyDef,
  type PropValue,
  type QueryResult,
  type RecordRow,
  type RollupFn,
  type SelectOption,
  type SortRule,
  type ViewConfig,
} from "./types";

export type StoredRecord = {
  id: string;
  title: string;
  icon: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  properties: Record<string, unknown>;
};
export type CollectionData = { props: PropertyDef[]; records: StoredRecord[] };
/** Acceso a otras colecciones (relaciones y rollups). */
export type World = (collectionId: string) => CollectionData | undefined;

const iso = (d: Date | string) => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());
const isDateValue = (v: unknown): v is DateValue => !!v && typeof v === "object" && !Array.isArray(v) && "start" in (v as object);
const options = (p: PropertyDef): SelectOption[] => p.config.options ?? [];

// ── Valores calculados ───────────────────────────────────────────────

function toCalc(v: FValue): CalcValue {
  if (v === null) return null;
  if (v instanceof Date) return { start: v.toISOString(), time: true };
  if (Array.isArray(v)) return v.map((x) => (typeof x === "number" ? x : String(x instanceof Date ? x.toISOString() : x))) as string[] | number[];
  return v;
}

/** Valor «de fórmula» de una propiedad ya resuelta. */
function toFormulaValue(p: PropertyDef | null, stored: PropValue | CalcValue | undefined, record: StoredRecord, world: World): FValue {
  if (!p) return record.title;
  switch (p.type) {
    case "number":
      return typeof stored === "number" ? stored : null;
    case "checkbox":
      return stored === true;
    case "select":
    case "status":
      return options(p).find((o) => o.id === stored)?.name ?? null;
    case "multi_select":
      return Array.isArray(stored) ? (stored as string[]).map((id) => options(p).find((o) => o.id === id)?.name ?? id) : [];
    case "date":
      return isDateValue(stored) ? new Date(stored.start) : null;
    case "created_time":
      return new Date(iso(record.createdAt));
    case "last_edited_time":
      return new Date(iso(record.updatedAt));
    case "relation": {
      const target = p.config.relationCollectionId ? world(p.config.relationCollectionId) : undefined;
      return Array.isArray(stored) ? (stored as string[]).map((id) => target?.records.find((r) => r.id === id)?.title ?? "") : [];
    }
    case "files":
      return Array.isArray(stored) ? (stored as { name: string }[]).map((f) => f.name) : [];
    case "formula":
    case "rollup": {
      if (isDateValue(stored)) return new Date(stored.start);
      return (stored ?? null) as FValue;
    }
    default:
      return typeof stored === "string" ? stored : stored == null ? null : String(stored);
  }
}

const numeric = (v: unknown): number | null => (typeof v === "number" && !Number.isNaN(v) ? v : null);
const isEmptyValue = (v: unknown): boolean =>
  v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0) || v === false;

function rollup(fn: RollupFn, values: unknown[]): CalcValue {
  const flatVals = values.flatMap((v) => (Array.isArray(v) ? v : [v]));
  const nums = flatVals.map(numeric).filter((n): n is number => n !== null);
  const present = flatVals.filter((v) => !(v === null || v === undefined || v === ""));
  switch (fn) {
    case "count":
      return values.length;
    case "count_values":
    case "count_not_empty":
      return present.length;
    case "count_empty":
      return values.length - present.filter((v) => v !== false).length;
    case "count_unique":
      return new Set(present.map((v) => (isDateValue(v) ? v.start : String(v)))).size;
    case "sum":
      return nums.reduce((a, b) => a + b, 0);
    case "average":
      return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    case "median": {
      if (!nums.length) return null;
      const s = [...nums].sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    }
    case "min":
      return nums.length ? Math.min(...nums) : null;
    case "max":
      return nums.length ? Math.max(...nums) : null;
    case "range":
      return nums.length ? Math.max(...nums) - Math.min(...nums) : null;
    case "percent_checked":
      return values.length ? (values.filter((v) => v === true).length / values.length) * 100 : 0;
    case "show_original":
      return present.map((v) => (isDateValue(v) ? v.start : String(v)));
  }
}

class Computer {
  private memo = new Map<string, PropValue | CalcValue | undefined>();
  private visiting = new Set<string>();
  constructor(private world: World, private now: () => Date) {}

  value(collectionId: string, recordId: string, propId: string): PropValue | CalcValue | undefined {
    const key = `${collectionId}:${recordId}:${propId}`;
    if (this.memo.has(key)) return this.memo.get(key);
    if (this.visiting.has(key)) return null; // ciclo (p. ej. fórmulas que se referencian entre sí)
    this.visiting.add(key);
    const data = this.world(collectionId);
    const record = data?.records.find((r) => r.id === recordId);
    const p = data?.props.find((x) => x.id === propId);
    let out: PropValue | CalcValue | undefined = null;
    if (data && record && p) out = this.compute(collectionId, data, record, p);
    this.visiting.delete(key);
    this.memo.set(key, out);
    return out;
  }

  private compute(collectionId: string, data: CollectionData, record: StoredRecord, p: PropertyDef): PropValue | CalcValue {
    if (p.type === "created_time") return { start: iso(record.createdAt), time: true };
    if (p.type === "last_edited_time") return { start: iso(record.updatedAt), time: true };
    if (p.type === "rollup") {
      const rel = data.props.find((x) => x.id === p.config.rollupRelationId);
      const targetId = rel?.config.relationCollectionId;
      const ids = (this.value(collectionId, record.id, rel?.id ?? "") as string[] | null) ?? [];
      if (!rel || !targetId || !p.config.rollupTargetId || !p.config.rollupFn) return null;
      const vals = ids.map((rid) => (p.config.rollupTargetId === TITLE_ID ? this.world(targetId)?.records.find((r) => r.id === rid)?.title : this.value(targetId, rid, p.config.rollupTargetId!)));
      return rollup(p.config.rollupFn, vals);
    }
    if (p.type === "formula") {
      if (!p.config.expression) return null;
      try {
        const v = evaluateFormula(p.config.expression, {
          now: this.now,
          prop: (name) => {
            if (name === "Nombre" && !data.props.some((x) => x.name === name)) return record.title;
            const ref = data.props.find((x) => x.name === name);
            if (!ref) throw new FormulaError(`Propiedad desconocida: ${name}`);
            return toFormulaValue(ref, this.value(collectionId, record.id, ref.id), record, this.world);
          },
        });
        return toCalc(v);
      } catch {
        return null;
      }
    }
    return normalizeStored(p, record.properties[p.id]);
  }
}

/** Normaliza un valor almacenado para un tipo (tolera datos antiguos o mal formados). */
export function normalizeStored(p: PropertyDef, raw: unknown): PropValue {
  switch (p.type) {
    case "number":
      return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
    case "checkbox":
      return raw === true;
    case "multi_select":
    case "relation":
      return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
    case "date":
      return isDateValue(raw) ? raw : null;
    case "files":
      return Array.isArray(raw) ? (raw as { name: string; url: string }[]).filter((f) => f && typeof f.url === "string") : [];
    case "select":
    case "status":
      return typeof raw === "string" && raw ? raw : null;
    default:
      return typeof raw === "string" ? raw : null;
  }
}

export function computeRows(collectionId: string, world: World, now: () => Date = () => new Date()): RecordRow[] {
  const data = world(collectionId);
  if (!data) return [];
  const c = new Computer(world, now);
  return data.records.map((r) => {
    const values: RecordRow["values"] = {};
    for (const p of data.props) values[p.id] = (c.value(collectionId, r.id, p.id) ?? null) as RecordRow["values"][string];
    return { id: r.id, title: r.title, icon: r.icon, createdAt: iso(r.createdAt), updatedAt: iso(r.updatedAt), values };
  });
}

// ── Filtros ──────────────────────────────────────────────────────────

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const day = (iso8601: string) => iso8601.slice(0, 10);

function relativeDay(v: unknown, now: Date): string | null {
  if (typeof v !== "string") return null;
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (v === "today") return base.toISOString().slice(0, 10);
  if (v === "tomorrow") return new Date(base.getTime() + 864e5).toISOString().slice(0, 10);
  if (v === "yesterday") return new Date(base.getTime() - 864e5).toISOString().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}/.test(v) ? day(v) : null;
}

function conditionHolds(row: RecordRow, props: PropertyDef[], c: FilterCondition, now: Date): boolean {
  const p = c.propertyId === TITLE_ID ? null : props.find((x) => x.id === c.propertyId);
  if (c.propertyId !== TITLE_ID && !p) return true; // propiedad eliminada: el filtro no aplica
  const v: unknown = p ? row.values[p.id] : row.title;
  const op = c.operator;
  if (op === "is_empty") return isEmptyValue(v) || (typeof v === "boolean" && !v);
  if (op === "is_not_empty") return !(isEmptyValue(v) || (typeof v === "boolean" && !v));
  const type = p?.type ?? "text";

  if (type === "checkbox" || typeof v === "boolean") return op === "is_not" ? v !== (c.value === true) : v === (c.value === true);
  if (isDateValue(v) || type === "date" || type === "created_time" || type === "last_edited_time") {
    if (!isDateValue(v)) return false;
    const a = day(v.start);
    const b = relativeDay(c.value, now);
    if (!b) return true;
    switch (op) {
      case "is":
      case "eq":
        return a === b;
      case "is_not":
      case "neq":
        return a !== b;
      case "before":
        return a < b;
      case "after":
        return a > b;
      case "on_or_before":
        return a <= b;
      case "on_or_after":
        return a >= b;
    }
    return true;
  }
  if (Array.isArray(v)) {
    const has = v.some((x) => (typeof x === "string" ? x === c.value : false));
    return op === "not_contains" || op === "is_not" ? !has : has;
  }
  if (type === "select" || type === "status") return op === "is_not" ? v !== c.value : v === c.value;
  if (typeof v === "number" || type === "number") {
    if (typeof v !== "number" || typeof c.value !== "number") return false;
    switch (op) {
      case "eq":
      case "is":
        return v === c.value;
      case "neq":
      case "is_not":
        return v !== c.value;
      case "gt":
        return v > c.value;
      case "lt":
        return v < c.value;
      case "gte":
        return v >= c.value;
      case "lte":
        return v <= c.value;
    }
    return true;
  }
  const s = fold(String(v ?? ""));
  const q = fold(String(c.value ?? ""));
  switch (op) {
    case "contains":
      return s.includes(q);
    case "not_contains":
      return !s.includes(q);
    case "is":
    case "eq":
      return s === q;
    case "is_not":
    case "neq":
      return s !== q;
    case "starts_with":
      return s.startsWith(q);
    case "ends_with":
      return s.endsWith(q);
  }
  return true;
}

const isGroup = (x: FilterCondition | FilterGroup): x is FilterGroup => "conditions" in x;

export function matchesFilter(row: RecordRow, props: PropertyDef[], filter: FilterGroup | undefined, now: Date): boolean {
  if (!filter || filter.conditions.length === 0) return true;
  const test = (x: FilterCondition | FilterGroup): boolean => (isGroup(x) ? matchesFilter(row, props, x, now) : conditionHolds(row, props, x, now));
  return filter.op === "and" ? filter.conditions.every(test) : filter.conditions.some(test);
}

// ── Orden ────────────────────────────────────────────────────────────

function sortKey(p: PropertyDef | null, row: RecordRow): number | string | null {
  const v: unknown = p ? row.values[p.id] : row.title;
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (isDateValue(v)) return v.start;
  if (Array.isArray(v)) return v.length ? String(v[0]) : null;
  if (p && (p.type === "select" || p.type === "status")) {
    const i = options(p).findIndex((o) => o.id === v);
    return i < 0 ? null : i;
  }
  return fold(String(v));
}

export function sortRows(rows: RecordRow[], props: PropertyDef[], sorts: SortRule[] | undefined): RecordRow[] {
  if (!sorts?.length) return rows;
  const rules = sorts.map((s) => ({ p: s.propertyId === TITLE_ID ? null : props.find((x) => x.id === s.propertyId) ?? undefined, dir: s.direction === "asc" ? 1 : -1 }));
  return [...rows].sort((a, b) => {
    for (const r of rules) {
      if (r.p === undefined) continue;
      const ka = sortKey(r.p, a);
      const kb = sortKey(r.p, b);
      if (ka === kb) continue;
      if (ka === null) return 1; // vacíos siempre al final
      if (kb === null) return -1;
      const cmp = typeof ka === "number" && typeof kb === "number" ? ka - kb : String(ka).localeCompare(String(kb), "es");
      if (cmp !== 0) return cmp * r.dir;
    }
    return 0;
  });
}

// ── Búsqueda ─────────────────────────────────────────────────────────

export function matchesSearch(row: RecordRow, props: PropertyDef[], q: string): boolean {
  const needle = fold(q.trim());
  if (!needle) return true;
  const parts: string[] = [row.title];
  for (const p of props) {
    const v = row.values[p.id];
    if (v === null || v === undefined) continue;
    if (p.type === "select" || p.type === "status") parts.push(options(p).find((o) => o.id === v)?.name ?? "");
    else if (p.type === "multi_select" && Array.isArray(v)) parts.push(...(v as string[]).map((id) => options(p).find((o) => o.id === id)?.name ?? ""));
    else if (typeof v === "string" || typeof v === "number") parts.push(String(v));
  }
  return fold(parts.join(" ")).includes(needle);
}

// ── Agrupación ───────────────────────────────────────────────────────

export function groupRows(rows: RecordRow[], props: PropertyDef[], g: GroupConfig): NonNullable<QueryResult["groups"]> {
  const p = g.propertyId === TITLE_ID ? null : props.find((x) => x.id === g.propertyId);
  if (!p) return [{ key: "__all__", label: "", rowIds: rows.map((r) => r.id) }];
  const groups: NonNullable<QueryResult["groups"]> = [];
  const ensure = (key: string, label: string, color?: SelectOption["color"]) => {
    let grp = groups.find((x) => x.key === key);
    if (!grp) groups.push((grp = { key, label, color, rowIds: [] }));
    return grp;
  };
  if (p.type === "select" || p.type === "status" || p.type === "multi_select") {
    for (const o of options(p)) ensure(o.id, o.name, o.color);
    ensure("__empty__", `Sin ${p.name}`);
  } else if (p.type === "checkbox") {
    ensure("true", "Marcado");
    ensure("false", "Sin marcar");
  }
  for (const r of rows) {
    const v = r.values[p.id];
    if (p.type === "select" || p.type === "status") ensure(typeof v === "string" ? v : "__empty__", "").rowIds.push(r.id);
    else if (p.type === "multi_select") {
      const ids = Array.isArray(v) && v.length ? (v as string[]) : ["__empty__"];
      for (const id of ids) ensure(id, "").rowIds.push(r.id);
    } else if (p.type === "checkbox") ensure(v === true ? "true" : "false", "").rowIds.push(r.id);
    else {
      const key = v === null || v === undefined || v === "" ? "__empty__" : isDateValue(v) ? v.start.slice(0, 7) : String(v);
      ensure(key, key === "__empty__" ? `Sin ${p.name}` : key).rowIds.push(r.id);
    }
  }
  let out = groups.filter((x) => !(g.hideEmpty && x.rowIds.length === 0) && !g.hiddenGroups?.includes(x.key));
  if (!["select", "status", "multi_select", "checkbox"].includes(p.type)) {
    out = out.sort((a, b) => a.key.localeCompare(b.key, "es", { numeric: true }) * (g.direction === "desc" ? -1 : 1));
    out = [...out.filter((x) => x.key !== "__empty__"), ...out.filter((x) => x.key === "__empty__")];
  } else if (g.direction === "desc") out = [...out].reverse();
  return out;
}

// ── Cálculos de columna ──────────────────────────────────────────────

export function calculate(fn: CalcFn, p: PropertyDef | null, rows: RecordRow[]): number | string | null {
  if (fn === "none") return null;
  const vals = rows.map((r) => (p ? r.values[p.id] : r.title));
  const empty = (v: unknown) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
  const nums = vals.map(numeric).filter((n): n is number => n !== null);
  switch (fn) {
    case "count":
      return rows.length;
    case "count_values":
    case "count_not_empty":
      return vals.filter((v) => !empty(v) && v !== false).length;
    case "count_empty":
      return vals.filter((v) => empty(v) || v === false).length;
    case "percent_empty":
      return rows.length ? (vals.filter((v) => empty(v) || v === false).length / rows.length) * 100 : 0;
    case "percent_not_empty":
      return rows.length ? (vals.filter((v) => !empty(v) && v !== false).length / rows.length) * 100 : 0;
    case "count_unique":
      return new Set(vals.filter((v) => !empty(v)).map((v) => JSON.stringify(v))).size;
    case "sum":
      return nums.reduce((a, b) => a + b, 0);
    case "average":
      return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    case "median":
      return rollup("median", nums) as number | null;
    case "min":
      return nums.length ? Math.min(...nums) : null;
    case "max":
      return nums.length ? Math.max(...nums) : null;
    case "range":
      return nums.length ? Math.max(...nums) - Math.min(...nums) : null;
    case "checked":
      return vals.filter((v) => v === true).length;
    case "unchecked":
      return vals.filter((v) => v !== true).length;
    case "percent_checked":
      return rows.length ? (vals.filter((v) => v === true).length / rows.length) * 100 : 0;
    case "earliest":
    case "latest": {
      const ds = vals.filter(isDateValue).map((d) => d.start).sort();
      return ds.length ? (fn === "earliest" ? ds[0] : ds[ds.length - 1]) : null;
    }
  }
}

// ── Consulta completa ────────────────────────────────────────────────

export function runQuery(
  collectionId: string,
  world: World,
  config: ViewConfig,
  opts: { search?: string; now?: () => Date } = {},
): QueryResult {
  const now = opts.now ?? (() => new Date());
  const data = world(collectionId);
  if (!data) return { rows: [], calculations: {}, total: 0 };
  const all = computeRows(collectionId, world, now);
  const filtered = all.filter((r) => matchesFilter(r, data.props, config.filter, now()) && (!opts.search || matchesSearch(r, data.props, opts.search)));
  const sorted = sortRows(filtered, data.props, config.sorts);
  const calculations: QueryResult["calculations"] = {};
  for (const [propId, fn] of Object.entries(config.calculations ?? {})) {
    if (fn && fn !== "none") calculations[propId] = calculate(fn, propId === TITLE_ID ? null : data.props.find((x) => x.id === propId) ?? null, sorted);
  }
  const groups = config.group ? groupRows(sorted, data.props, config.group) : undefined;
  return { rows: sorted, groups, calculations, total: all.length };
}

export const isComputed = (p: PropertyDef) => COMPUTED_TYPES.includes(p.type);
