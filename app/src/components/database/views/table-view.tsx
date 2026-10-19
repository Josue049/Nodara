"use client";

import { BookmarkPlus, ChevronDown, ChevronRight, Copy, ExternalLink, Plus, Trash2 } from "lucide-react";
import { RecordLink as Link, usePeek } from "../peek";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CALC_LABELS, formatCalc } from "@/lib/collections/format";
import { TITLE_ID, type PropertyDef, type RecordRow } from "@/lib/collections/types";
import { t } from "@/lib/strings";
import { PageIcon } from "../../page-icon";
import { PopoverMenu } from "../../popover-menu";
import { EditableCell, Tag } from "../cells";
import { CalcMenu } from "../filter-sort";
import { anchorOf, type Anchor } from "../popover";
import { AddPropertyPopover, PropertyMenu } from "../property-menus";
import { PropertyIcon } from "../property-icon";
import type { Database } from "../use-database";

const TITLE_W = 280;
const COL_W = 200;

/** Propiedades visibles en el orden de la vista. */
/** Filas que se pintan de golpe en la tabla; «Mostrar más filas» añade otro bloque. */
const PAGE_ROWS = 100;

export function visibleProps(db: Database): PropertyDef[] {
  const order = db.view?.config.visibleProperties;
  if (!order) return db.props;
  return order.map((id) => db.props.find((p) => p.id === id)).filter((p): p is PropertyDef => !!p);
}

function TitleCell({ db, row, editing, setEditing, showIcon }: { db: Database; row: RecordRow; editing: boolean; setEditing: (v: boolean) => void; showIcon: boolean }) {
  const [draft, setDraft] = useState(row.title);
  const commit = () => {
    setEditing(false);
    if (draft !== row.title) void db.setTitle(row.id, draft);
  };
  return (
    <div className="group/title flex min-w-0 flex-1 items-center gap-1.5">
      {showIcon && (
        <Link href={`/${row.id}`} aria-label={`${t.open} ${row.title || t.untitled}`} className="flex size-5 shrink-0 items-center justify-center" tabIndex={-1}>
          <PageIcon icon={row.icon} size={16} />
        </Link>
      )}
      {editing ? (
        <input
          autoFocus
          value={draft}
          aria-label={t.title}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            else if (e.key === "Escape") setEditing(false);
          }}
          className="min-w-0 flex-1 bg-transparent font-medium outline-none"
        />
      ) : (
        <button
          type="button"
          data-testid="row-title"
          onClick={() => {
            if (!db.canEdit) return;
            setDraft(row.title);
            setEditing(true);
          }}
          className={`min-w-0 flex-1 truncate text-left font-medium ${row.title ? "" : "text-ink-3"}`}
        >
          {row.title || t.untitled}
        </button>
      )}
      <Link
        href={`/${row.id}`}
        aria-label={`${t.open} ${row.title || t.untitled}`}
        data-testid="open-row"
        className="flex h-6 shrink-0 items-center gap-1 rounded border border-line bg-[var(--bg)] px-1.5 text-[12px] font-medium text-ink-2 opacity-0 shadow-sm hover:bg-hover group-hover/title:opacity-100 focus-visible:opacity-100"
      >
        <ExternalLink size={12} /> {t.openUpper}
      </Link>
    </div>
  );
}

export function TableView({ db }: { db: Database }) {
  const router = useRouter();
  const peek = usePeek();
  const cfg = db.view?.config ?? {};
  const props = visibleProps(db);
  const widths = cfg.columnWidths ?? {};
  const w = (id: string) => widths[id] ?? (id === TITLE_ID ? TITLE_W : COL_W);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ row: RecordRow; at: { x: number; y: number } } | null>(null);
  const [headMenu, setHeadMenu] = useState<{ prop: PropertyDef | null; anchor: Anchor } | null>(null);
  const [addAnchor, setAddAnchor] = useState<Anchor | null>(null);
  const [calc, setCalc] = useState<{ prop: PropertyDef | null; anchor: Anchor } | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // Con miles de filas solo se pintan las primeras (el resto se carga a petición): mantiene ligera la página.
  const [shown, setShown] = useState(PAGE_ROWS);
  const [resizing, setResizing] = useState<{ id: string; width: number } | null>(null);
  const showIcon = cfg.showPageIcon !== false;
  const vlines = cfg.showVerticalLines !== false;
  const wrap = cfg.wrapCells === true;
  const rowsById = new Map(db.rows.map((r) => [r.id, r]));
  const totalW = w(TITLE_ID) + props.reduce((a, p) => a + w(p.id), 0) + 40;
  const widthOf = (id: string) => (resizing?.id === id ? resizing.width : w(id));

  const startResize = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = w(id);
    const move = (ev: PointerEvent) => setResizing({ id, width: Math.max(80, startW + ev.clientX - startX) });
    const up = (ev: PointerEvent) => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      const final = Math.max(80, startW + ev.clientX - startX);
      setResizing(null);
      void db.updateViewConfig({ columnWidths: { ...widths, [id]: final } });
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  };

  const newRow = async (groupKey?: string) => {
    const g = cfg.group;
    const gp = g ? db.props.find((p) => p.id === g.propertyId) : null;
    const init: Record<string, unknown> = {};
    if (gp && groupKey && groupKey !== "__empty__" && groupKey !== "__all__") {
      if (gp.type === "select" || gp.type === "status") init[gp.id] = groupKey;
      else if (gp.type === "multi_select") init[gp.id] = [groupKey];
      else if (gp.type === "checkbox") init[gp.id] = groupKey === "true";
    }
    const id = await db.addRow({ properties: init });
    setEditingTitle(id);
  };

  const renderRow = (row: RecordRow) => (
    <div
      key={row.id}
      role="row"
      data-testid="db-row"
      data-row-id={row.id}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ row, at: { x: e.clientX, y: e.clientY } });
      }}
      className="group/row flex hover:bg-hover/60"
      style={{ width: totalW }}
    >
      <div role="gridcell" className={`nd-db-cell flex min-h-[36.8px] items-center px-2 ${vlines ? "nd-db-vline" : ""}`} style={{ width: widthOf(TITLE_ID), flex: "none" }}>
        <TitleCell db={db} row={row} editing={editingTitle === row.id} setEditing={(v) => setEditingTitle(v ? row.id : null)} showIcon={showIcon} />
      </div>
      {props.map((p) => (
        <div key={p.id} role="gridcell" className={`nd-db-cell flex min-h-[36.8px] items-center px-2 py-1 ${vlines ? "nd-db-vline" : ""} ${wrap ? "" : "overflow-hidden"}`} style={{ width: widthOf(p.id), flex: "none" }}>
          <EditableCell prop={p} value={row.values[p.id]} ctx={db.ctx} onChange={(v) => void db.setCell(row.id, p.id, v)} />
        </div>
      ))}
      <div className="nd-db-cell" style={{ width: 40, flex: "none" }} />
    </div>
  );

  const addRowButton = (groupKey?: string) =>
    !db.canEdit ? null : (
    <div role="row">
      <div role="gridcell">
        <button
          type="button"
          onClick={() => void newRow(groupKey)}
          data-testid="add-row"
          className="nd-db-cell flex h-[28px] items-center gap-2 px-2 text-[14px] text-ink-3 hover:bg-hover"
          style={{ width: totalW }}
        >
          <Plus size={14} /> {t.newPage}
        </button>
      </div>
    </div>
  );

  const groups = db.groups;
  const footer = (
    <div role="row" className="group/foot flex" style={{ width: totalW }} data-testid="calc-row">
      {[null, ...props].map((p) => {
        const id = p?.id ?? TITLE_ID;
        const fn = cfg.calculations?.[id] ?? "none";
        const value = db.calculations[id];
        return (
          <div key={id} role="gridcell" className="flex h-[32px] items-center justify-end px-2 text-[12px]" style={{ width: p ? widthOf(id) : widthOf(TITLE_ID), flex: "none" }}>
            <button
              type="button"
              aria-label={`Calcular ${p?.name ?? "Nombre"}`}
              data-testid="calc-btn"
              onClick={(e) => setCalc({ prop: p, anchor: anchorOf(e.currentTarget) })}
              className={`rounded px-1.5 py-0.5 hover:bg-hover ${fn === "none" ? "text-ink-3 opacity-0 group-hover/foot:opacity-100 focus-visible:opacity-100" : "text-ink-2"}`}
            >
              {fn === "none" ? t.calculate : (
                <>
                  <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-3">{CALC_LABELS[fn]}</span>
                  <span className="text-[14px] text-ink" data-testid="calc-value">{formatCalc(fn, value ?? null, p)}</span>
                </>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="nd-scroll overflow-x-auto pb-4" data-testid="table-view">
      <div role="grid" aria-label={t.table} style={{ width: totalW }}>
        <div role="row" className="flex" style={{ width: totalW }}>
          {[null, ...props].map((p) => {
            const id = p?.id ?? TITLE_ID;
            return (
              <div key={id} role="columnheader" className={`nd-db-cell relative flex h-[36px] items-center ${vlines ? "nd-db-vline" : ""}`} style={{ width: widthOf(id), flex: "none" }}>
                <button
                  type="button"
                  data-testid="col-header"
                  onClick={(e) => setHeadMenu({ prop: p, anchor: anchorOf(e.currentTarget) })}
                  className="flex h-full min-w-0 flex-1 items-center gap-1.5 px-2 text-[14px] hover:bg-hover"
                  style={{ color: "var(--db-header)" }}
                >
                  <PropertyIcon type={p?.type ?? "title"} size={16} />
                  <span className="truncate">{p?.name ?? t.name}</span>
                </button>
                <div
                  role="separator"
                  aria-label={`Redimensionar ${p?.name ?? t.name}`}
                  onPointerDown={(e) => startResize(e, id)}
                  className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize hover:bg-accent/40"
                />
              </div>
            );
          })}
          <div role="columnheader" aria-label={t.addProperty} className="nd-db-cell flex h-[36px] items-center justify-center" style={{ width: 40, flex: "none" }}>
            {db.canEdit && <button
              type="button"
              aria-label={t.addProperty}
              data-testid="add-prop"
              onClick={(e) => setAddAnchor(anchorOf(e.currentTarget))}
              className="flex size-7 items-center justify-center rounded text-ink-3 hover:bg-hover"
            >
              <Plus size={16} />
            </button>}
          </div>
        </div>

        {groups
          ? groups.map((g) => {
              const open = !collapsed.has(g.key);
              const gp = db.props.find((p) => p.id === cfg.group?.propertyId);
              const opt = gp?.config.options?.find((o) => o.id === g.key);
              return (
                <div key={g.key} role="rowgroup" data-testid="group" data-group={g.key}>
                  <div role="row" className="flex h-[36px] items-center gap-1.5 px-1" style={{ width: totalW }}>
                    <div role="gridcell" className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label={open ? t.collapse : t.expand}
                      onClick={() => setCollapsed((c) => (c.has(g.key) ? new Set([...c].filter((x) => x !== g.key)) : new Set([...c, g.key])))}
                      className="flex size-5 items-center justify-center rounded hover:bg-hover"
                    >
                      {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    {opt ? <Tag option={opt} status={gp?.type === "status"} /> : <span className="font-medium text-ink-2">{g.label || t.noValue}</span>}
                    <span className="text-[14px] text-ink-3" data-testid="group-count">{g.rowIds.length}</span>
                    </div>
                  </div>
                  {open && g.rowIds.map((id) => rowsById.get(id)).filter((r): r is RecordRow => !!r).map(renderRow)}
                  {open && addRowButton(g.key)}
                </div>
              );
            })
          : db.rows.slice(0, shown).map(renderRow)}
        {!groups && db.rows.length > shown && (
          <div role="row">
            <div role="gridcell">
              <button type="button" data-testid="load-more" onClick={() => setShown((n) => n + PAGE_ROWS)} className="nd-db-cell flex h-[32px] items-center gap-2 px-2 text-[14px] text-ink-2 hover:bg-hover" style={{ width: totalW }}>
                Mostrar más filas ({db.rows.length - shown} restantes)
              </button>
            </div>
          </div>
        )}
        {!groups && addRowButton()}
        {footer}
      </div>

      {menu && (
        <PopoverMenu
          at={menu.at}
          onClose={() => setMenu(null)}
          items={[
            { label: t.open, icon: <ExternalLink size={16} />, onSelect: () => (peek.openIn === "side" ? peek.open(menu.row.id) : router.push(`/${menu.row.id}`)) },
            ...(db.canEdit
              ? [
                  { label: t.duplicate, icon: <Copy size={16} />, onSelect: () => void db.duplicateRow(menu.row.id) },
                  { label: t.saveAsTemplate, icon: <BookmarkPlus size={16} />, onSelect: () => void db.saveAsTemplate(menu.row.id) },
                  { label: t.moveToTrash, icon: <Trash2 size={16} />, danger: true, onSelect: () => void db.deleteRow(menu.row.id) },
                ]
              : []),
          ]}
        />
      )}
      {headMenu && <PropertyMenu anchor={headMenu.anchor} db={db} prop={headMenu.prop} onClose={() => setHeadMenu(null)} />}
      {addAnchor && <AddPropertyPopover anchor={addAnchor} db={db} onClose={() => setAddAnchor(null)} />}
      {calc && <CalcMenu db={db} prop={calc.prop} anchor={calc.anchor} onClose={() => setCalc(null)} />}
    </div>
  );
}
