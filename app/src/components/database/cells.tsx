"use client";

import { Check, FileText, Paperclip, Plus, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatDate, formatNumber, optionById, tagVar } from "@/lib/collections/format";
import { COMPUTED_TYPES, type DateValue, type FileValue, type PropertyDef, type QueryResult, type SelectOption } from "@/lib/collections/types";
import { t } from "@/lib/strings";
import { PageIcon } from "../page-icon";
import { dbApi } from "./api";
import { Anchor, anchorOf, MenuRow, Popover } from "./popover";

export type CellCtx = {
  refs: NonNullable<QueryResult["refs"]>;
  /** Crea una opción nueva en una propiedad select/multi_select/status. */
  createOption: (propertyId: string, name: string) => Promise<SelectOption>;
};

const isDate = (v: unknown): v is DateValue => !!v && typeof v === "object" && !Array.isArray(v) && "start" in (v as object);

export function Tag({ option, status }: { option: SelectOption; status?: boolean }) {
  return (
    <span className="nd-tag" style={tagVar(option.color)}>
      {status && <span className="mr-1.5 size-2 shrink-0 rounded-full bg-current opacity-70" aria-hidden />}
      {option.name}
    </span>
  );
}

/** Representación de solo lectura de un valor (también usada por tablero, galería, lista…). */
export function CellValue({ prop, value, ctx }: { prop: PropertyDef; value: unknown; ctx: CellCtx }) {
  const empty = value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
  if (empty && prop.type !== "checkbox") return null;
  switch (prop.type) {
    case "number":
      return <span className="tabular-nums">{formatNumber(value as number, prop.config.format)}</span>;
    case "select":
    case "status": {
      const o = optionById(prop, value);
      return o ? <Tag option={o} status={prop.type === "status"} /> : null;
    }
    case "multi_select":
      return (
        <span className="flex flex-wrap gap-1">
          {(value as string[]).map((id) => {
            const o = optionById(prop, id);
            return o ? <Tag key={id} option={o} /> : null;
          })}
        </span>
      );
    case "date":
    case "created_time":
    case "last_edited_time":
      return <span>{formatDate(value as DateValue)}</span>;
    case "checkbox":
      return <input type="checkbox" checked={value === true} readOnly tabIndex={-1} className="pointer-events-none size-4 accent-[var(--accent)]" aria-label={prop.name} />;
    case "url":
      return (
        <a href={String(value)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="truncate text-ink-2 underline decoration-ink-3 underline-offset-2">
          {String(value)}
        </a>
      );
    case "email":
      return (
        <a href={`mailto:${String(value)}`} onClick={(e) => e.stopPropagation()} className="truncate underline decoration-ink-3 underline-offset-2">
          {String(value)}
        </a>
      );
    case "phone":
      return (
        <a href={`tel:${String(value)}`} onClick={(e) => e.stopPropagation()} className="truncate underline decoration-ink-3 underline-offset-2">
          {String(value)}
        </a>
      );
    case "files":
      return (
        <span className="flex flex-wrap gap-x-2">
          {(value as FileValue[]).map((f) => (
            <a key={f.url} href={f.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex max-w-full items-center gap-1 truncate underline decoration-ink-3 underline-offset-2">
              <FileText size={14} className="shrink-0 text-ink-3" />
              <span className="truncate">{f.name}</span>
            </a>
          ))}
        </span>
      );
    case "relation":
      return (
        <span className="flex flex-wrap gap-1">
          {(value as string[]).map((id) => {
            const r = ctx.refs[id];
            return (
              <Link key={id} href={`/${id}`} onClick={(e) => e.stopPropagation()} className="inline-flex max-w-full items-center gap-1 rounded bg-hover px-1.5 text-[14px] leading-5" data-testid="relation-chip">
                <PageIcon icon={r?.icon ?? null} size={14} />
                <span className="truncate">{r?.title || t.untitled}</span>
              </Link>
            );
          })}
        </span>
      );
    case "formula":
    case "rollup": {
      if (typeof value === "boolean") return <input type="checkbox" checked={value} readOnly tabIndex={-1} className="pointer-events-none size-4 accent-[var(--accent)]" aria-label={prop.name} />;
      if (typeof value === "number") return <span className="tabular-nums">{formatNumber(value, "number_with_commas")}</span>;
      if (isDate(value)) return <span>{formatDate(value)}</span>;
      if (Array.isArray(value)) return <span className="truncate">{value.join(", ")}</span>;
      return <span className="truncate">{String(value)}</span>;
    }
    default:
      return <span className="truncate">{String(value)}</span>;
  }
}

export const isRightAligned = (p: PropertyDef) => p.type === "number";
export const isReadOnlyType = (p: PropertyDef) => COMPUTED_TYPES.includes(p.type);

// ── Edición ──────────────────────────────────────────────────────────

function OptionPicker({
  prop,
  value,
  multi,
  anchor,
  ctx,
  onChange,
  onClose,
}: {
  prop: PropertyDef;
  value: unknown;
  multi: boolean;
  anchor: Anchor;
  ctx: CellCtx;
  onChange: (v: string | string[] | null) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const selected = new Set(multi ? ((value as string[]) ?? []) : value ? [value as string] : []);
  const opts = (prop.config.options ?? []).filter((o) => o.name.toLowerCase().includes(q.trim().toLowerCase()));
  const exact = (prop.config.options ?? []).some((o) => o.name.toLowerCase() === q.trim().toLowerCase());

  const toggle = (id: string) => {
    if (multi) {
      const next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onChange([...next]);
    } else {
      onChange(selected.has(id) ? null : id);
      onClose();
    }
  };
  const create = async () => {
    const o = await ctx.createOption(prop.id, q.trim());
    setQ("");
    toggle(o.id);
  };

  return (
    <Popover anchor={anchor} onClose={onClose} label={prop.name} testId="option-picker" width={240}>
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (opts.length && (exact || !q.trim())) toggle(opts[0].id);
            else if (q.trim() && !exact) void create();
          }
        }}
        placeholder={t.searchOrCreate}
        aria-label={t.searchOrCreate}
        className="mb-1 w-full rounded-md border border-line bg-transparent px-2 py-1 outline-none focus:border-accent"
      />
      {opts.map((o) => (
        <MenuRow key={o.id} onClick={() => toggle(o.id)} right={selected.has(o.id) ? <Check size={14} /> : null} testId="option-item">
          <Tag option={o} status={prop.type === "status"} />
        </MenuRow>
      ))}
      {q.trim() && !exact && (
        <MenuRow onClick={create} icon={<Plus size={14} />} testId="create-option">
          {t.create} «{q.trim()}»
        </MenuRow>
      )}
      {!multi && selected.size > 0 && (
        <MenuRow onClick={() => (onChange(null), onClose())} icon={<X size={14} />}>
          {t.clear}
        </MenuRow>
      )}
    </Popover>
  );
}

function DatePicker({ value, anchor, onChange, onClose, label }: { value: DateValue | null; anchor: Anchor; onChange: (v: DateValue | null) => void; onClose: () => void; label: string }) {
  const [start, setStart] = useState(value?.start?.slice(0, 10) ?? "");
  const [end, setEnd] = useState(value?.end?.slice(0, 10) ?? "");
  const [range, setRange] = useState(!!value?.end);
  const commit = (s: string, e: string, r: boolean) => {
    if (!s) return onChange(null);
    onChange({ start: s, ...(r && e && e >= s ? { end: e } : {}) });
  };
  return (
    <Popover anchor={anchor} onClose={onClose} label={label} testId="date-picker" width={260}>
      <div className="flex flex-col gap-2 p-1">
        <label className="flex flex-col gap-1 text-[12px] text-ink-3">
          {t.startDate}
          <input
            type="date"
            autoFocus
            value={start}
            aria-label={t.startDate}
            onChange={(e) => {
              setStart(e.target.value);
              commit(e.target.value, end, range);
            }}
            className="rounded-md border border-line bg-transparent px-2 py-1 text-[14px] text-ink outline-none focus:border-accent"
          />
        </label>
        <label className="flex items-center gap-2 text-[14px]">
          <input
            type="checkbox"
            checked={range}
            onChange={(e) => {
              setRange(e.target.checked);
              commit(start, end, e.target.checked);
            }}
            className="size-4 accent-[var(--accent)]"
          />
          {t.endDate}
        </label>
        {range && (
          <input
            type="date"
            value={end}
            min={start || undefined}
            aria-label={t.endDate}
            onChange={(e) => {
              setEnd(e.target.value);
              commit(start, e.target.value, true);
            }}
            className="rounded-md border border-line bg-transparent px-2 py-1 text-[14px] outline-none focus:border-accent"
          />
        )}
        <MenuRow
          onClick={() => {
            onChange(null);
            onClose();
          }}
          icon={<X size={14} />}
        >
          {t.clear}
        </MenuRow>
      </div>
    </Popover>
  );
}

function FilesPicker({ value, anchor, onChange, onClose, label }: { value: FileValue[]; anchor: Anchor; onChange: (v: FileValue[]) => void; onClose: () => void; label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const upload = async (file: File) => {
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/files", { method: "POST", body: form });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "No se pudo subir");
      onChange([...value, (await res.json()) as FileValue]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Popover anchor={anchor} onClose={onClose} label={label} testId="files-picker" width={280}>
      <div className="p-1">
        {value.map((f) => (
          <div key={f.url} className="flex items-center gap-2 rounded px-1 py-1 hover:bg-hover">
            <FileText size={14} className="text-ink-3" />
            <a href={f.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate">
              {f.name}
            </a>
            <button type="button" aria-label={`${t.remove} ${f.name}`} onClick={() => onChange(value.filter((x) => x.url !== f.url))} className="rounded p-0.5 hover:bg-active">
              <X size={14} />
            </button>
          </div>
        ))}
        <label className="mt-1 flex h-[30px] cursor-pointer items-center gap-2 rounded-md px-2 hover:bg-hover">
          <Paperclip size={14} className="text-ink-2" />
          {busy ? t.uploading : t.uploadFile}
          <input
            type="file"
            data-testid="file-input"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
        </label>
        {error && <p role="alert" className="px-2 text-[12px] text-danger">{error}</p>}
      </div>
    </Popover>
  );
}

function RelationPicker({ prop, value, anchor, onChange, onClose }: { prop: PropertyDef; value: string[]; anchor: Anchor; onChange: (v: string[]) => void; onClose: () => void }) {
  const [rows, setRows] = useState<{ id: string; title: string; icon: string | null }[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => {
    const target = prop.config.relationCollectionId;
    if (!target) return;
    let alive = true;
    dbApi.query(target, { config: {} }).then((r) => alive && setRows(r.rows.map((x) => ({ id: x.id, title: x.title, icon: x.icon })))).catch(() => {});
    return () => {
      alive = false;
    };
  }, [prop.config.relationCollectionId]);
  const sel = new Set(value);
  const shown = rows.filter((r) => r.title.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Popover anchor={anchor} onClose={onClose} label={prop.name} testId="relation-picker" width={280}>
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t.searchPages}
        aria-label={t.searchPages}
        className="mb-1 w-full rounded-md border border-line bg-transparent px-2 py-1 outline-none focus:border-accent"
      />
      {shown.map((r) => (
        <MenuRow
          key={r.id}
          icon={<PageIcon icon={r.icon} size={14} />}
          right={sel.has(r.id) ? <Check size={14} /> : null}
          testId="relation-item"
          onClick={() => {
            const next = new Set(sel);
            if (next.has(r.id)) next.delete(r.id);
            else next.add(r.id);
            onChange([...next]);
          }}
        >
          {r.title || t.untitled}
        </MenuRow>
      ))}
      {shown.length === 0 && <p className="px-2 py-2 text-ink-3">{t.noResults}</p>}
    </Popover>
  );
}

/** Celda editable: texto/número en línea; el resto abre un selector. */
export function EditableCell({
  prop,
  value,
  ctx,
  onChange,
  readOnly,
}: {
  prop: PropertyDef;
  value: unknown;
  ctx: CellCtx;
  onChange: (v: unknown) => void;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [draft, setDraft] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const locked = readOnly || isReadOnlyType(prop);
  const inlineText = ["text", "number", "url", "email", "phone"].includes(prop.type);

  const open = () => {
    if (locked) return;
    if (prop.type === "checkbox") return onChange(value !== true);
    if (inlineText) {
      setDraft(value === null || value === undefined ? "" : String(value));
      setEditing(true);
    } else if (ref.current) setAnchor(anchorOf(ref.current));
  };
  const closePicker = () => setAnchor(null);

  const commit = () => {
    setEditing(false);
    const v = draft.trim();
    if (prop.type === "number") {
      if (v === "") return value === null ? undefined : onChange(null);
      const n = Number(v.replace(",", "."));
      if (!Number.isNaN(n) && n !== value) onChange(n);
    } else if (v !== (value ?? "")) onChange(v === "" ? null : v);
  };

  return (
    <div
      ref={ref}
      role={locked ? undefined : "button"}
      tabIndex={locked ? undefined : 0}
      aria-label={locked ? undefined : `${prop.name}: editar`}
      data-testid="cell"
      data-prop={prop.name}
      onClick={() => !editing && open()}
      onKeyDown={(e) => {
        if (!editing && (e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
          e.preventDefault();
          open();
        }
      }}
      className={`flex min-h-[28px] w-full items-center ${isRightAligned(prop) ? "justify-end" : ""} ${locked ? "" : "cursor-text"}`}
    >
      {editing ? (
        <input
          autoFocus
          value={draft}
          inputMode={prop.type === "number" ? "decimal" : undefined}
          aria-label={prop.name}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") commit();
            else if (e.key === "Escape") setEditing(false);
          }}
          className={`w-full rounded bg-transparent px-0 outline-none ${isRightAligned(prop) ? "text-right" : ""}`}
        />
      ) : (
        <div className="min-w-0 max-w-full">
          <CellValue prop={prop} value={value} ctx={ctx} />
        </div>
      )}
      {anchor && (prop.type === "select" || prop.type === "status" || prop.type === "multi_select") && (
        <OptionPicker prop={prop} value={value} multi={prop.type === "multi_select"} anchor={anchor} ctx={ctx} onChange={onChange} onClose={closePicker} />
      )}
      {anchor && prop.type === "date" && <DatePicker value={(value as DateValue) ?? null} anchor={anchor} onChange={onChange} onClose={closePicker} label={prop.name} />}
      {anchor && prop.type === "files" && <FilesPicker value={(value as FileValue[]) ?? []} anchor={anchor} onChange={onChange} onClose={closePicker} label={prop.name} />}
      {anchor && prop.type === "relation" && <RelationPicker prop={prop} value={(value as string[]) ?? []} anchor={anchor} onChange={onChange} onClose={closePicker} />}
    </div>
  );
}
