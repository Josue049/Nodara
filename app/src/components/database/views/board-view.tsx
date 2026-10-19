"use client";

import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { RecordLink as Link } from "../peek";
import { useState } from "react";
import type { PropertyDef, RecordRow } from "@/lib/collections/types";
import { t } from "@/lib/strings";
import { PageIcon } from "../../page-icon";
import { CellValue, Tag } from "../cells";
import type { Database } from "../use-database";
import { visibleProps } from "./table-view";

export function groupableProps(db: Database): PropertyDef[] {
  return db.props.filter((p) => ["select", "status", "multi_select", "checkbox"].includes(p.type));
}

/** Valor a escribir en la propiedad de agrupación al soltar una tarjeta en una columna. */
export function groupValue(p: PropertyDef, key: string): unknown {
  if (key === "__empty__") return p.type === "multi_select" ? [] : p.type === "checkbox" ? false : null;
  if (p.type === "multi_select") return [key];
  if (p.type === "checkbox") return key === "true";
  return key;
}

function Card({ db, row, props, dragging }: { db: Database; row: RecordRow; props: PropertyDef[]; dragging?: boolean }) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: row.id, disabled: !db.canEdit });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      data-testid="board-card"
      data-row-id={row.id}
      className={`rounded-lg border border-line bg-[var(--bg)] p-2.5 shadow-sm hover:bg-hover/50 ${isDragging ? "opacity-40" : ""} ${dragging ? "shadow-[var(--shadow-pop)]" : ""}`}
    >
      <Link href={`/${row.id}`} draggable={false} className="flex items-center gap-1.5 font-medium">
        <PageIcon icon={row.icon} size={16} />
        <span className={row.title ? "" : "text-ink-3"}>{row.title || t.untitled}</span>
      </Link>
      <div className="mt-1.5 flex flex-col gap-1 text-[14px]">
        {props.map((p) => (row.values[p.id] === null || row.values[p.id] === undefined || row.values[p.id] === "" || (Array.isArray(row.values[p.id]) && (row.values[p.id] as unknown[]).length === 0) ? null : (
          <div key={p.id} className="min-w-0">
            <CellValue prop={p} value={row.values[p.id]} ctx={db.ctx} />
          </div>
        )))}
      </div>
    </div>
  );
}

function Column({ db, groupKey, label, prop, rows, cardProps }: { db: Database; groupKey: string; label: string; prop: PropertyDef; rows: RecordRow[]; cardProps: PropertyDef[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${groupKey}` });
  const opt = prop.config.options?.find((o) => o.id === groupKey);
  return (
    <section ref={setNodeRef} data-testid="board-column" data-group={groupKey} aria-label={label || t.noValue} className={`flex w-[260px] shrink-0 flex-col gap-2 rounded-lg p-1.5 ${isOver ? "bg-accent/10" : ""}`}>
      <header className="flex items-center gap-2 px-1 py-0.5">
        {opt ? <Tag option={opt} status={prop.type === "status"} /> : <span className="font-medium text-ink-2">{groupKey === "true" ? "Marcado" : groupKey === "false" ? "Sin marcar" : label || `Sin ${prop.name}`}</span>}
        <span className="text-[14px] text-ink-3" data-testid="column-count">{rows.length}</span>
      </header>
      {rows.map((r) => (
        <Card key={r.id} db={db} row={r} props={cardProps} />
      ))}
      {db.canEdit && <button
        type="button"
        data-testid="board-add"
        onClick={() => void db.addRow({ properties: groupKey === "__empty__" ? {} : { [prop.id]: groupValue(prop, groupKey) } })}
        className="flex h-[30px] items-center gap-2 rounded-md px-2 text-[14px] text-ink-3 hover:bg-hover"
      >
        <Plus size={14} /> {t.newPage}
      </button>}
    </section>
  );
}

export function BoardView({ db }: { db: Database }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [active, setActive] = useState<RecordRow | null>(null);
  const gp = db.props.find((p) => p.id === db.view?.config.group?.propertyId);
  const rowsById = new Map(db.rows.map((r) => [r.id, r]));

  if (!gp || !db.groups) {
    const opts = groupableProps(db);
    return (
      <div className="px-2 py-6 text-ink-2" data-testid="board-setup">
        <p className="mb-2">{t.boardNeedsGroup}</p>
        {opts.length === 0 ? (
          <p className="text-ink-3">{t.boardNoProps}</p>
        ) : (
          <select aria-label={t.groupBy} defaultValue="" onChange={(e) => e.target.value && void db.updateViewConfig({ group: { propertyId: e.target.value } })} className="h-8 rounded-md border border-line bg-transparent px-2">
            <option value="">{t.groupBy}…</option>
            {opts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>
    );
  }

  const cardProps = visibleProps(db).filter((p) => p.id !== gp.id);
  const onEnd = (e: DragEndEvent) => {
    setActive(null);
    const over = e.over ? String(e.over.id) : "";
    if (!over.startsWith("col:")) return;
    const row = rowsById.get(String(e.active.id));
    const key = over.slice(4);
    if (!row) return;
    const cur = row.values[gp.id];
    const already = Array.isArray(cur) ? cur.length === 1 && cur[0] === key : (cur ?? "__empty__") === key || (gp.type === "checkbox" && String(cur === true) === key);
    if (!already) void db.setCell(row.id, gp.id, groupValue(gp, key));
  };

  return (
    <DndContext sensors={sensors} onDragStart={(e) => setActive(rowsById.get(String(e.active.id)) ?? null)} onDragEnd={onEnd} onDragCancel={() => setActive(null)}>
      <div className="nd-scroll flex gap-2 overflow-x-auto pb-4" data-testid="board-view">
        {db.groups.map((g) => (
          <Column key={g.key} db={db} groupKey={g.key} label={g.label} prop={gp} rows={g.rowIds.map((id) => rowsById.get(id)).filter((r): r is RecordRow => !!r)} cardProps={cardProps} />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>{active && <div className="w-[240px]"><Card db={db} row={active} props={cardProps} dragging /></div>}</DragOverlay>
    </DndContext>
  );
}
