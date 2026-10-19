"use client";

import { ArrowDownUp, Plus, Trash2 } from "lucide-react";
import { CALC_LABELS, calcOptionsFor } from "@/lib/collections/format";
import {
  TITLE_ID,
  type FilterCondition,
  type FilterGroup,
  type FilterOperator,
  type PropertyDef,
  type SortRule,
} from "@/lib/collections/types";
import { Anchor, MenuRow, Popover } from "./popover";
import { PropertyIcon } from "./property-icon";
import type { Database } from "./use-database";

type OpDef = { op: FilterOperator; label: string; needsValue: boolean };

const TEXT_OPS: OpDef[] = [
  { op: "contains", label: "contiene", needsValue: true },
  { op: "not_contains", label: "no contiene", needsValue: true },
  { op: "is", label: "es", needsValue: true },
  { op: "is_not", label: "no es", needsValue: true },
  { op: "starts_with", label: "empieza por", needsValue: true },
  { op: "ends_with", label: "termina en", needsValue: true },
  { op: "is_empty", label: "está vacío", needsValue: false },
  { op: "is_not_empty", label: "no está vacío", needsValue: false },
];
const NUM_OPS: OpDef[] = [
  { op: "eq", label: "=", needsValue: true },
  { op: "neq", label: "≠", needsValue: true },
  { op: "gt", label: ">", needsValue: true },
  { op: "lt", label: "<", needsValue: true },
  { op: "gte", label: "≥", needsValue: true },
  { op: "lte", label: "≤", needsValue: true },
  { op: "is_empty", label: "está vacío", needsValue: false },
  { op: "is_not_empty", label: "no está vacío", needsValue: false },
];
const SELECT_OPS: OpDef[] = [
  { op: "is", label: "es", needsValue: true },
  { op: "is_not", label: "no es", needsValue: true },
  { op: "is_empty", label: "está vacío", needsValue: false },
  { op: "is_not_empty", label: "no está vacío", needsValue: false },
];
const MULTI_OPS: OpDef[] = [
  { op: "contains", label: "contiene", needsValue: true },
  { op: "not_contains", label: "no contiene", needsValue: true },
  { op: "is_empty", label: "está vacío", needsValue: false },
  { op: "is_not_empty", label: "no está vacío", needsValue: false },
];
const CHECK_OPS: OpDef[] = [{ op: "is", label: "es", needsValue: true }];
const DATE_OPS: OpDef[] = [
  { op: "is", label: "es", needsValue: true },
  { op: "before", label: "es anterior a", needsValue: true },
  { op: "after", label: "es posterior a", needsValue: true },
  { op: "on_or_before", label: "es igual o anterior a", needsValue: true },
  { op: "on_or_after", label: "es igual o posterior a", needsValue: true },
  { op: "is_empty", label: "está vacío", needsValue: false },
  { op: "is_not_empty", label: "no está vacío", needsValue: false },
];
const EMPTY_OPS: OpDef[] = [
  { op: "is_empty", label: "está vacío", needsValue: false },
  { op: "is_not_empty", label: "no está vacío", needsValue: false },
];

export function operatorsFor(p: PropertyDef | null): OpDef[] {
  switch (p?.type) {
    case undefined:
    case "text":
    case "url":
    case "email":
    case "phone":
      return TEXT_OPS;
    case "number":
    case "formula":
    case "rollup":
      return p.type === "number" ? NUM_OPS : [...NUM_OPS];
    case "select":
    case "status":
      return SELECT_OPS;
    case "multi_select":
      return MULTI_OPS;
    case "checkbox":
      return CHECK_OPS;
    case "date":
    case "created_time":
    case "last_edited_time":
      return DATE_OPS;
    default:
      return EMPTY_OPS;
  }
}

function defaultCondition(p: PropertyDef | null): FilterCondition {
  const op = operatorsFor(p)[0];
  let value: FilterCondition["value"] = "";
  if (p?.type === "number") value = 0;
  else if (p?.type === "checkbox") value = true;
  else if (p && ["select", "status", "multi_select"].includes(p.type)) value = p.config.options?.[0]?.id ?? "";
  else if (p && ["date", "created_time", "last_edited_time"].includes(p.type)) value = "today";
  return { propertyId: p?.id ?? TITLE_ID, operator: op.op, value: op.needsValue ? value : null };
}

const isGroup = (x: FilterCondition | FilterGroup): x is FilterGroup => "conditions" in x;
const inputCls = "h-8 min-w-0 rounded-md border border-line bg-transparent px-2 outline-none focus:border-accent";

function ValueInput({ p, c, onChange }: { p: PropertyDef | null; c: FilterCondition; onChange: (v: FilterCondition["value"]) => void }) {
  if (!operatorsFor(p).find((o) => o.op === c.operator)?.needsValue) return null;
  const type = p?.type ?? "text";
  if (type === "select" || type === "status" || type === "multi_select") {
    return (
      <select aria-label="Valor del filtro" value={String(c.value ?? "")} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        {(p?.config.options ?? []).map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    );
  }
  if (type === "checkbox") {
    return (
      <select aria-label="Valor del filtro" value={String(c.value === true)} onChange={(e) => onChange(e.target.value === "true")} className={inputCls}>
        <option value="true">Marcado</option>
        <option value="false">Sin marcar</option>
      </select>
    );
  }
  if (type === "date" || type === "created_time" || type === "last_edited_time") {
    const rel = ["today", "tomorrow", "yesterday"].includes(String(c.value));
    return (
      <span className="flex gap-1">
        <select
          aria-label="Fecha de referencia"
          value={rel ? String(c.value) : "exact"}
          onChange={(e) => onChange(e.target.value === "exact" ? new Date().toISOString().slice(0, 10) : e.target.value)}
          className={inputCls}
        >
          <option value="today">Hoy</option>
          <option value="tomorrow">Mañana</option>
          <option value="yesterday">Ayer</option>
          <option value="exact">Fecha exacta</option>
        </select>
        {!rel && <input type="date" aria-label="Fecha" value={String(c.value ?? "").slice(0, 10)} onChange={(e) => onChange(e.target.value)} className={inputCls} />}
      </span>
    );
  }
  if (type === "number" || type === "formula" || type === "rollup") {
    return (
      <input
        type="number"
        aria-label="Valor del filtro"
        value={typeof c.value === "number" ? c.value : ""}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        className={`${inputCls} w-24`}
      />
    );
  }
  return <input aria-label="Valor del filtro" value={String(c.value ?? "")} onChange={(e) => onChange(e.target.value)} placeholder="Valor…" className={inputCls} />;
}

export function FilterPopover({ anchor, db, onClose }: { anchor: Anchor; db: Database; onClose: () => void }) {
  const filter: FilterGroup = db.view?.config.filter ?? { op: "and", conditions: [] };
  const save = (next: FilterGroup) => db.updateViewConfig({ filter: next.conditions.length ? next : undefined });
  const filterable = [{ id: TITLE_ID, name: "Nombre", type: "title" as const }, ...db.props.map((p) => ({ id: p.id, name: p.name, type: p.type }))];
  const propOf = (id: string) => db.props.find((p) => p.id === id) ?? null;

  const setCond = (i: number, c: FilterCondition) => save({ ...filter, conditions: filter.conditions.map((x, j) => (j === i ? c : x)) });

  return (
    <Popover anchor={anchor} onClose={onClose} label="Filtrar" testId="filter-popover" width={540} align="right">
      <div className="flex flex-col gap-1.5 p-2">
        {filter.conditions.length === 0 && <p className="px-1 py-1 text-ink-3">Sin filtros. Añade una condición para filtrar las filas.</p>}
        {filter.conditions.map((c, i) => {
          if (isGroup(c)) {
            return (
              <div key={i} className="flex items-center gap-2 rounded-md bg-hover px-2 py-1">
                <span className="flex-1">Grupo de {c.conditions.length} condiciones ({c.op === "and" ? "y" : "o"})</span>
                <button type="button" aria-label="Quitar grupo" onClick={() => save({ ...filter, conditions: filter.conditions.filter((_, j) => j !== i) })} className="rounded p-1 hover:bg-active">
                  <Trash2 size={14} />
                </button>
              </div>
            );
          }
          const p = propOf(c.propertyId);
          const ops = operatorsFor(p);
          return (
            <div key={i} className="flex flex-wrap items-center gap-1.5" data-testid="filter-row">
              {i === 0 ? (
                <span className="w-14 text-ink-3">Donde</span>
              ) : i === 1 ? (
                <select aria-label="Operador lógico" value={filter.op} onChange={(e) => save({ ...filter, op: e.target.value as "and" | "or" })} className={`${inputCls} w-14`}>
                  <option value="and">y</option>
                  <option value="or">o</option>
                </select>
              ) : (
                <span className="w-14 text-ink-3">{filter.op === "and" ? "y" : "o"}</span>
              )}
              <select
                aria-label="Propiedad del filtro"
                value={c.propertyId}
                onChange={(e) => setCond(i, defaultCondition(propOf(e.target.value)))}
                className={`${inputCls} w-36`}
              >
                {filterable.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Operador"
                value={c.operator}
                onChange={(e) => {
                  const def = ops.find((o) => o.op === e.target.value)!;
                  setCond(i, { ...c, operator: def.op, value: def.needsValue ? (c.value ?? defaultCondition(p).value) : null });
                }}
                className={`${inputCls} w-40`}
              >
                {ops.map((o) => (
                  <option key={o.op} value={o.op}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ValueInput p={p} c={c} onChange={(v) => setCond(i, { ...c, value: v })} />
              <button type="button" aria-label="Quitar filtro" onClick={() => save({ ...filter, conditions: filter.conditions.filter((_, j) => j !== i) })} className="ml-auto rounded p-1 hover:bg-active">
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
        <MenuRow icon={<Plus size={14} />} onClick={() => save({ ...filter, conditions: [...filter.conditions, defaultCondition(null)] })} testId="add-filter">
          Agregar filtro
        </MenuRow>
        {filter.conditions.length > 0 && (
          <MenuRow icon={<Trash2 size={14} />} danger onClick={() => save({ ...filter, conditions: [] })}>
            Eliminar filtros
          </MenuRow>
        )}
      </div>
    </Popover>
  );
}

export function SortPopover({ anchor, db, onClose }: { anchor: Anchor; db: Database; onClose: () => void }) {
  const sorts: SortRule[] = db.view?.config.sorts ?? [];
  const save = (next: SortRule[]) => db.updateViewConfig({ sorts: next });
  const options = [{ id: TITLE_ID, name: "Nombre" }, ...db.props.map((p) => ({ id: p.id, name: p.name }))];
  return (
    <Popover anchor={anchor} onClose={onClose} label="Ordenar" testId="sort-popover" width={420} align="right">
      <div className="flex flex-col gap-1.5 p-2">
        {sorts.length === 0 && <p className="px-1 py-1 text-ink-3">Sin orden. Añade una regla para ordenar las filas.</p>}
        {sorts.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5" data-testid="sort-row">
            <ArrowDownUp size={14} className="text-ink-3" />
            <select aria-label="Propiedad de orden" value={s.propertyId} onChange={(e) => save(sorts.map((x, j) => (j === i ? { ...x, propertyId: e.target.value } : x)))} className={`${inputCls} flex-1`}>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <select aria-label="Dirección" value={s.direction} onChange={(e) => save(sorts.map((x, j) => (j === i ? { ...x, direction: e.target.value as "asc" | "desc" } : x)))} className={`${inputCls} w-36`}>
              <option value="asc">Ascendente</option>
              <option value="desc">Descendente</option>
            </select>
            <button type="button" aria-label="Quitar orden" onClick={() => save(sorts.filter((_, j) => j !== i))} className="rounded p-1 hover:bg-active">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <MenuRow icon={<Plus size={14} />} onClick={() => save([...sorts, { propertyId: options.find((o) => !sorts.some((s) => s.propertyId === o.id))?.id ?? TITLE_ID, direction: "asc" }])} testId="add-sort">
          Agregar orden
        </MenuRow>
      </div>
    </Popover>
  );
}

export function CalcMenu({ db, prop, onClose, anchor }: { db: Database; prop: PropertyDef | null; onClose: () => void; anchor: Anchor }) {
  const current = db.view?.config.calculations?.[prop?.id ?? TITLE_ID] ?? "none";
  return (
    <Popover anchor={anchor} onClose={onClose} label="Calcular" testId="calc-menu" width={220}>
      {calcOptionsFor(prop).map((fn) => (
        <MenuRow
          key={fn}
          active={fn === current}
          onClick={() => {
            onClose();
            void db.updateViewConfig({ calculations: { ...(db.view?.config.calculations ?? {}), [prop?.id ?? TITLE_ID]: fn } });
          }}
        >
          {CALC_LABELS[fn]}
        </MenuRow>
      ))}
    </Popover>
  );
}

export { PropertyIcon };
