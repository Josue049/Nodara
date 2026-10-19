"use client";

import { ArrowDownAZ, ArrowUpAZ, EyeOff, Filter, Group, Plus, Sigma, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ROLLUP_LABELS, TYPE_LABELS } from "@/lib/collections/format";
import {
  OPTION_COLORS,
  PROPERTY_TYPES,
  TITLE_ID,
  type CollectionBundle,
  type PropertyConfig,
  type PropertyDef,
  type PropertyType,
  type RollupFn,
  type SelectOption,
} from "@/lib/collections/types";
import { dbApi } from "./api";
import { CalcMenu } from "./filter-sort";
import { anchorOf, MenuRow, Popover, type Anchor } from "./popover";
import { PropertyIcon } from "./property-icon";
import type { Database } from "./use-database";

const field = "h-8 w-full rounded-md border border-line bg-transparent px-2 outline-none focus:border-accent";
const GROUPABLE: PropertyType[] = ["select", "status", "multi_select", "checkbox", "text", "number", "date"];

// ── Alta de propiedad ────────────────────────────────────────────────

export function AddPropertyPopover({ anchor, db, onClose }: { anchor: Anchor; db: Database; onClose: () => void }) {
  const [name, setName] = useState("");
  const [q, setQ] = useState("");
  const [type, setType] = useState<PropertyType | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // formula
  const [expression, setExpression] = useState("");
  // relación
  const [collections, setCollections] = useState<{ id: string; title: string }[]>([]);
  const [target, setTarget] = useState("");
  const [both, setBoth] = useState(true);
  // rollup
  const [relId, setRelId] = useState("");
  const [targetBundle, setTargetBundle] = useState<CollectionBundle | null>(null);
  const [targetProp, setTargetProp] = useState(TITLE_ID);
  const [fn, setFn] = useState<RollupFn>("count");

  const relations = db.props.filter((p) => p.type === "relation");
  useEffect(() => {
    if (type === "relation") void dbApi.list().then((l) => (setCollections(l), setTarget((t) => t || l[0]?.id || "")));
  }, [type]);
  useEffect(() => {
    const rel = relations.find((r) => r.id === relId);
    if (type === "rollup" && rel?.config.relationCollectionId) void dbApi.bundle(rel.config.relationCollectionId).then(setTargetBundle);
  }, [type, relId, relations]);

  const uniqueName = (base: string) => {
    let n = base;
    let i = 2;
    while (db.props.some((p) => p.name.toLowerCase() === n.toLowerCase())) n = `${base} ${i++}`;
    return n;
  };

  const create = async (t: PropertyType, config?: PropertyConfig, bidirectional?: boolean) => {
    setBusy(true);
    setError("");
    try {
      await db.addProperty({ name: name.trim() || uniqueName(TYPE_LABELS[t]), type: t, config, bidirectional });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const pick = (t: PropertyType) => {
    if (t === "formula" || t === "relation" || t === "rollup") return setType(t);
    void create(t);
  };

  const list = PROPERTY_TYPES.filter((t) => TYPE_LABELS[t].toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <Popover anchor={anchor} onClose={onClose} label="Agregar propiedad" testId="add-property" width={300}>
      <div className="p-1">
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la propiedad…" aria-label="Nombre de la propiedad" className={`${field} mb-1`} />
        {!type && (
          <>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar tipo…" aria-label="Buscar tipo" className={`${field} mb-1`} />
            <p className="px-2 py-1 text-[12px] font-medium text-ink-3">Selecciona el tipo</p>
            {list.map((t) => (
              <MenuRow key={t} icon={<PropertyIcon type={t} />} onClick={() => pick(t)} testId={`type-${t}`}>
                {TYPE_LABELS[t]}
              </MenuRow>
            ))}
          </>
        )}
        {type === "formula" && (
          <div className="flex flex-col gap-2 p-1">
            <label className="text-[12px] text-ink-3">Fórmula, p. ej. prop(&quot;Horas&quot;) * 10</label>
            <textarea value={expression} onChange={(e) => setExpression(e.target.value)} aria-label="Fórmula" rows={3} className="w-full rounded-md border border-line bg-transparent p-2 font-mono text-[13px] outline-none focus:border-accent" />
            <button type="button" disabled={busy || !expression.trim()} onClick={() => void create("formula", { expression })} className="h-8 rounded-md bg-accent text-white disabled:opacity-50">
              Crear propiedad
            </button>
          </div>
        )}
        {type === "relation" && (
          <div className="flex flex-col gap-2 p-1">
            <label className="text-[12px] text-ink-3">Base de datos relacionada</label>
            <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Base de datos relacionada" className={field}>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title || "Sin título"}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={both} onChange={(e) => setBoth(e.target.checked)} className="size-4 accent-[var(--accent)]" />
              Crear propiedad recíproca
            </label>
            <button type="button" disabled={busy || !target} onClick={() => void create("relation", { relationCollectionId: target }, both)} className="h-8 rounded-md bg-accent text-white disabled:opacity-50">
              Crear propiedad
            </button>
          </div>
        )}
        {type === "rollup" && (
          <div className="flex flex-col gap-2 p-1">
            {relations.length === 0 ? (
              <p className="text-ink-3">Primero crea una propiedad de relación.</p>
            ) : (
              <>
                <select value={relId} onChange={(e) => setRelId(e.target.value)} aria-label="Relación" className={field}>
                  <option value="">Relación…</option>
                  {relations.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <select value={targetProp} onChange={(e) => setTargetProp(e.target.value)} aria-label="Propiedad" className={field}>
                  <option value={TITLE_ID}>Nombre</option>
                  {(targetBundle?.properties ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select value={fn} onChange={(e) => setFn(e.target.value as RollupFn)} aria-label="Cálculo" className={field}>
                  {(Object.keys(ROLLUP_LABELS) as RollupFn[]).map((f) => (
                    <option key={f} value={f}>
                      {ROLLUP_LABELS[f]}
                    </option>
                  ))}
                </select>
                <button type="button" disabled={busy || !relId} onClick={() => void create("rollup", { rollupRelationId: relId, rollupTargetId: targetProp, rollupFn: fn })} className="h-8 rounded-md bg-accent text-white disabled:opacity-50">
                  Crear propiedad
                </button>
              </>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="px-2 py-1 text-[13px] text-danger">
            {error}
          </p>
        )}
      </div>
    </Popover>
  );
}

// ── Editor de opciones ───────────────────────────────────────────────

function OptionsEditor({ prop, onSave }: { prop: PropertyDef; onSave: (options: SelectOption[]) => void }) {
  const options = prop.config.options ?? [];
  const [name, setName] = useState("");
  return (
    <div className="flex flex-col gap-1 p-1" data-testid="options-editor">
      <p className="text-[12px] font-medium text-ink-3">Opciones</p>
      {options.map((o) => (
        <div key={o.id} className="flex items-center gap-1" data-testid="option-row">
          <input
            defaultValue={o.name}
            aria-label={`Opción ${o.name}`}
            onBlur={(e) => e.target.value.trim() && e.target.value !== o.name && onSave(options.map((x) => (x.id === o.id ? { ...x, name: e.target.value.trim() } : x)))}
            className={`${field} flex-1`}
          />
          <select aria-label={`Color de ${o.name}`} value={o.color} onChange={(e) => onSave(options.map((x) => (x.id === o.id ? { ...x, color: e.target.value as SelectOption["color"] } : x)))} className="h-8 rounded-md border border-line bg-transparent px-1">
            {OPTION_COLORS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button type="button" aria-label={`Eliminar opción ${o.name}`} onClick={() => onSave(options.filter((x) => x.id !== o.id))} className="rounded p-1 hover:bg-active">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <form
        className="flex gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          const n = name.trim();
          if (!n || options.some((o) => o.name.toLowerCase() === n.toLowerCase())) return;
          setName("");
          onSave([...options, { id: crypto.randomUUID(), name: n, color: OPTION_COLORS[(options.length % 9) + 1], ...(prop.type === "status" ? { group: "todo" as const } : {}) }]);
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nueva opción…" aria-label="Nueva opción" className={`${field} flex-1`} />
        <button type="submit" aria-label="Añadir opción" className="rounded-md px-2 hover:bg-hover">
          <Plus size={14} />
        </button>
      </form>
    </div>
  );
}

// ── Menú de encabezado de columna ────────────────────────────────────

export function PropertyMenu({ anchor, db, prop, onClose }: { anchor: Anchor; db: Database; prop: PropertyDef | null; onClose: () => void }) {
  const [name, setName] = useState(prop?.name ?? "Nombre");
  const [expr, setExpr] = useState(prop?.config.expression ?? "");
  const [error, setError] = useState("");
  const [calcAnchor, setCalcAnchor] = useState<Anchor | null>(null);
  const id = prop?.id ?? TITLE_ID;
  const cfg = db.view?.config;

  const rename = async () => {
    if (!prop || !name.trim() || name.trim() === prop.name) return;
    try {
      await db.updateProperty(prop.id, { name: name.trim() });
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setName(prop.name);
    }
  };
  const saveConfig = async (config: PropertyConfig) => {
    if (!prop) return;
    try {
      await db.updateProperty(prop.id, { config });
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  };
  const visible = cfg?.visibleProperties ?? db.props.map((p) => p.id);

  return (
    <>
      <Popover anchor={anchor} onClose={onClose} label={`Propiedad ${prop?.name ?? "Nombre"}`} testId="property-menu" width={300}>
        <div className="p-1">
          <div className="mb-1 flex items-center gap-2">
            <PropertyIcon type={prop?.type ?? "title"} />
            <input
              value={name}
              disabled={!prop}
              aria-label="Nombre de la propiedad"
              onChange={(e) => setName(e.target.value)}
              onBlur={rename}
              onKeyDown={(e) => e.key === "Enter" && (e.currentTarget.blur(), undefined)}
              className={`${field} flex-1 disabled:opacity-60`}
            />
          </div>
          <p className="px-1 pb-1 text-[12px] text-ink-3">{prop ? TYPE_LABELS[prop.type] : "Título"}</p>
          {error && (
            <p role="alert" className="px-1 pb-1 text-[13px] text-danger">
              {error}
            </p>
          )}
          {prop?.type === "number" && (
            <label className="flex flex-col gap-1 px-1 pb-2 text-[12px] text-ink-3">
              Formato de número
              <select value={prop.config.format ?? "number"} onChange={(e) => void saveConfig({ format: e.target.value as PropertyConfig["format"] })} className={field} aria-label="Formato de número">
                <option value="number">Número</option>
                <option value="number_with_commas">Número con separadores</option>
                <option value="percent">Porcentaje</option>
                <option value="usd">Dólar</option>
                <option value="eur">Euro</option>
              </select>
            </label>
          )}
          {prop && ["select", "multi_select", "status"].includes(prop.type) && <OptionsEditor prop={prop} onSave={(options) => void saveConfig({ options })} />}
          {prop?.type === "formula" && (
            <div className="flex flex-col gap-1 p-1">
              <textarea value={expr} onChange={(e) => setExpr(e.target.value)} aria-label="Fórmula" rows={3} className="w-full rounded-md border border-line bg-transparent p-2 font-mono text-[13px] outline-none focus:border-accent" />
              <button type="button" onClick={() => void saveConfig({ expression: expr })} className="h-8 rounded-md bg-accent text-white">
                Guardar fórmula
              </button>
            </div>
          )}
          <div className="mt-1 border-t border-line pt-1">
            <MenuRow icon={<ArrowUpAZ size={14} />} onClick={() => (onClose(), void db.updateViewConfig({ sorts: [{ propertyId: id, direction: "asc" }] }))} testId="sort-asc">
              Ordenar ascendente
            </MenuRow>
            <MenuRow icon={<ArrowDownAZ size={14} />} onClick={() => (onClose(), void db.updateViewConfig({ sorts: [{ propertyId: id, direction: "desc" }] }))} testId="sort-desc">
              Ordenar descendente
            </MenuRow>
            <MenuRow
              icon={<Filter size={14} />}
              onClick={() => {
                onClose();
                const f = cfg?.filter ?? { op: "and" as const, conditions: [] };
                void db.updateViewConfig({ filter: { ...f, conditions: [...f.conditions, { propertyId: id, operator: prop?.type === "number" ? "gt" : prop?.type === "checkbox" ? "is" : "is_not_empty", value: prop?.type === "number" ? 0 : prop?.type === "checkbox" ? true : null }] } });
              }}
            >
              Filtrar por esta propiedad
            </MenuRow>
            {(!prop || GROUPABLE.includes(prop.type)) && (
              <MenuRow icon={<Group size={14} />} onClick={() => (onClose(), void db.updateViewConfig({ group: { propertyId: id } }))} testId="group-by">
                Agrupar por esta propiedad
              </MenuRow>
            )}
            <MenuRow icon={<Sigma size={14} />} onClick={(e) => setCalcAnchor(anchorOf(e.currentTarget))} testId="calc-open">
              Calcular
            </MenuRow>
            {prop && (
              <MenuRow icon={<EyeOff size={14} />} onClick={() => (onClose(), void db.updateViewConfig({ visibleProperties: visible.filter((x) => x !== prop.id) }))} testId="hide-prop">
                Ocultar en la vista
              </MenuRow>
            )}
            {prop && (
              <MenuRow icon={<Trash2 size={14} />} danger onClick={() => (onClose(), void db.deleteProperty(prop.id))} testId="delete-prop">
                Eliminar propiedad
              </MenuRow>
            )}
          </div>
        </div>
      </Popover>
      {calcAnchor && <CalcMenu db={db} prop={prop} anchor={calcAnchor} onClose={() => (setCalcAnchor(null), onClose())} />}
    </>
  );
}
