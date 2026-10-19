"use client";

import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { DateValue, PropertyDef, RecordRow } from "@/lib/collections/types";
import { t } from "@/lib/strings";
import { PageIcon } from "../../page-icon";
import type { Database } from "../use-database";

const DAY = 864e5;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const parse = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00Z`);
const addDays = (s: string, n: number) => iso(new Date(parse(s).getTime() + n * DAY));
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const WEEKDAYS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

function dateProp(db: Database): PropertyDef | null {
  const id = db.view?.config.dateProperty;
  return db.props.find((p) => p.id === id && p.type === "date") ?? db.props.find((p) => p.type === "date") ?? null;
}

function DateSetup({ db, label }: { db: Database; label: string }) {
  const dates = db.props.filter((p) => p.type === "date");
  return (
    <div className="px-2 py-6 text-ink-2" data-testid="date-setup">
      <p className="mb-2">{label}</p>
      {dates.length === 0 ? (
        <p className="text-ink-3">{t.needsDateProp}</p>
      ) : (
        <select aria-label={t.dateProperty} defaultValue="" onChange={(e) => e.target.value && void db.updateViewConfig({ dateProperty: e.target.value })} className="h-8 rounded-md border border-line bg-transparent px-2">
          <option value="">{t.dateProperty}…</option>
          {dates.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

const range = (row: RecordRow, p: PropertyDef): { start: string; end: string } | null => {
  const v = row.values[p.id] as DateValue | null;
  if (!v?.start) return null;
  const start = v.start.slice(0, 10);
  const end = (v.end ?? v.start).slice(0, 10);
  return { start, end: end < start ? start : end };
};

function DayChip({ row, dateId }: { row: RecordRow; dateId: string }) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: row.id, data: { dateId } });
  return (
    <Link
      ref={setNodeRef}
      {...listeners}
      href={`/${row.id}`}
      draggable={false}
      data-testid="calendar-chip"
      data-row-id={row.id}
      className={`flex min-w-0 items-center gap-1 truncate rounded bg-hover px-1.5 py-0.5 text-[13px] hover:bg-active ${isDragging ? "opacity-40" : ""}`}
    >
      <PageIcon icon={row.icon} size={12} />
      <span className="truncate">{row.title || t.untitled}</span>
    </Link>
  );
}

function DayCell({ day, inMonth, today, rows, dateId, onAdd }: { day: string; inMonth: boolean; today: boolean; rows: RecordRow[]; dateId: string; onAdd: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${day}` });
  return (
    <div ref={setNodeRef} data-testid="calendar-day" data-day={day} className={`group/day relative min-h-[110px] border-b border-r border-line p-1 ${inMonth ? "" : "bg-hover/40 text-ink-3"} ${isOver ? "bg-accent/10" : ""}`}>
      <div className="flex items-center justify-between">
        <span className={`inline-flex size-6 items-center justify-center rounded-full text-[13px] ${today ? "bg-accent text-white" : ""}`}>{Number(day.slice(8))}</span>
        <button type="button" aria-label={`${t.newPage} ${day}`} onClick={onAdd} data-testid="calendar-add" className="rounded p-0.5 text-ink-3 opacity-0 hover:bg-active group-hover/day:opacity-100 focus-visible:opacity-100">
          <Plus size={14} />
        </button>
      </div>
      <div className="mt-0.5 flex flex-col gap-0.5">
        {rows.map((r) => (
          <DayChip key={r.id} row={r} dateId={dateId} />
        ))}
      </div>
    </div>
  );
}

export function CalendarView({ db }: { db: Database }) {
  const dp = dateProp(db);
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [active, setActive] = useState<RecordRow | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const todayIso = iso(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));

  const days = useMemo(() => {
    const first = new Date(Date.UTC(cursor.y, cursor.m, 1));
    const offset = (first.getUTCDay() + 6) % 7; // semana desde el lunes
    const start = new Date(first.getTime() - offset * DAY);
    return Array.from({ length: 42 }, (_, i) => iso(new Date(start.getTime() + i * DAY)));
  }, [cursor]);

  if (!dp) return <DateSetup db={db} label={t.calendarNeedsDate} />;

  const byDay = new Map<string, RecordRow[]>();
  const undated: RecordRow[] = [];
  for (const r of db.rows) {
    const rg = range(r, dp);
    if (!rg) {
      undated.push(r);
      continue;
    }
    for (let d = rg.start, guard = 0; d <= rg.end && guard < 400; d = addDays(d, 1), guard++) byDay.set(d, [...(byDay.get(d) ?? []), r]);
  }

  const move = (e: DragEndEvent) => {
    setActive(null);
    const over = e.over ? String(e.over.id) : "";
    if (!over.startsWith("day:")) return;
    const row = db.rows.find((r) => r.id === e.active.id);
    if (!row) return;
    const target = over.slice(4);
    const cur = range(row, dp);
    if (cur && cur.start === target) return;
    const span = cur ? Math.round((parse(cur.end).getTime() - parse(cur.start).getTime()) / DAY) : 0;
    void db.setCell(row.id, dp.id, { start: target, ...(span > 0 ? { end: addDays(target, span) } : {}) });
  };
  const shift = (n: number) => setCursor((c) => ({ y: c.y + Math.floor((c.m + n) / 12), m: (((c.m + n) % 12) + 12) % 12 }));

  return (
    <DndContext sensors={sensors} onDragStart={(e) => setActive(db.rows.find((r) => r.id === e.active.id) ?? null)} onDragEnd={move} onDragCancel={() => setActive(null)}>
      <div data-testid="calendar-view" className="pb-4">
        <div className="mb-2 flex items-center gap-2">
          <h3 className="min-w-[160px] text-[16px] font-semibold capitalize" data-testid="calendar-title">
            {MONTHS[cursor.m]} {cursor.y}
          </h3>
          <button type="button" aria-label={t.prevMonth} onClick={() => shift(-1)} className="rounded p-1 hover:bg-hover"><ChevronLeft size={16} /></button>
          <button type="button" onClick={() => setCursor({ y: now.getFullYear(), m: now.getMonth() })} className="rounded px-2 py-0.5 text-[14px] hover:bg-hover">{t.today}</button>
          <button type="button" aria-label={t.nextMonth} onClick={() => shift(1)} className="rounded p-1 hover:bg-hover"><ChevronRight size={16} /></button>
          <span className="ml-auto text-[13px] text-ink-3">{dp.name}</span>
        </div>
        <div className="grid grid-cols-7 border-l border-t border-line">
          {WEEKDAYS.map((w) => (
            <div key={w} className="border-b border-r border-line px-2 py-1 text-[12px] uppercase text-ink-3">{w}</div>
          ))}
          {days.map((d) => (
            <DayCell
              key={d}
              day={d}
              inMonth={Number(d.slice(5, 7)) - 1 === cursor.m}
              today={d === todayIso}
              rows={byDay.get(d) ?? []}
              dateId={dp.id}
              onAdd={() => void db.addRow({ properties: { [dp.id]: { start: d } } })}
            />
          ))}
        </div>
        {undated.length > 0 && (
          <details className="mt-3" data-testid="undated">
            <summary className="cursor-pointer text-[14px] text-ink-2">{t.noDate} ({undated.length})</summary>
            <div className="mt-1 flex flex-wrap gap-1">
              {undated.map((r) => (
                <Link key={r.id} href={`/${r.id}`} className="rounded bg-hover px-1.5 py-0.5 text-[13px]">{r.title || t.untitled}</Link>
              ))}
            </div>
          </details>
        )}
      </div>
      <DragOverlay dropAnimation={null}>{active && <div className="rounded bg-[var(--popover)] px-2 py-1 text-[13px] shadow-[var(--shadow-pop)]">{active.title || t.untitled}</div>}</DragOverlay>
    </DndContext>
  );
}

const COL = 36;

export function TimelineView({ db }: { db: Database }) {
  const dp = dateProp(db);
  const todayIso = iso(new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())));
  if (!dp) return <DateSetup db={db} label={t.timelineNeedsDate} />;

  const dated = db.rows.map((r) => ({ r, rg: range(r, dp) }));
  const withDates = dated.filter((x): x is { r: RecordRow; rg: { start: string; end: string } } => !!x.rg);
  const starts = withDates.map((x) => x.rg.start).concat(todayIso).sort();
  const ends = withDates.map((x) => x.rg.end).concat(todayIso).sort();
  const first = addDays(starts[0], -3);
  const last = addDays(ends[ends.length - 1], 14);
  const count = Math.max(30, Math.round((parse(last).getTime() - parse(first).getTime()) / DAY) + 1);
  const dayList = Array.from({ length: count }, (_, i) => addDays(first, i));
  const offset = (d: string) => Math.round((parse(d).getTime() - parse(first).getTime()) / DAY);

  return (
    <div data-testid="timeline-view" className="nd-scroll overflow-x-auto pb-4">
      <div style={{ width: 200 + count * COL }}>
        <div className="flex h-[40px] border-b border-line text-[11px] text-ink-3">
          <div className="sticky left-0 z-10 w-[200px] shrink-0 bg-[var(--bg)] px-2 py-2">{t.name}</div>
          {dayList.map((d) => (
            <div key={d} className={`flex shrink-0 flex-col items-center justify-center border-l border-line ${d === todayIso ? "bg-accent/10 font-semibold text-accent" : ""}`} style={{ width: COL }}>
              <span>{Number(d.slice(8))}</span>
              {d.slice(8) === "01" || d === first ? <span className="text-[9px] uppercase">{MONTHS[Number(d.slice(5, 7)) - 1].slice(0, 3)}</span> : null}
            </div>
          ))}
        </div>
        {dated.map(({ r, rg }) => (
          <div key={r.id} data-testid="timeline-row" data-row-id={r.id} className="relative flex h-[36px] items-center border-b border-line">
            <Link href={`/${r.id}`} className="sticky left-0 z-10 flex w-[200px] shrink-0 items-center gap-1.5 truncate bg-[var(--bg)] px-2 text-[14px] font-medium">
              <PageIcon icon={r.icon} size={14} />
              <span className="truncate">{r.title || t.untitled}</span>
            </Link>
            <div className="relative h-full flex-1">
              {rg && (
                <Link
                  href={`/${r.id}`}
                  data-testid="timeline-bar"
                  title={`${rg.start} → ${rg.end}`}
                  className="absolute top-1.5 flex h-[24px] items-center truncate rounded bg-accent/80 px-2 text-[12px] text-white"
                  style={{ left: offset(rg.start) * COL, width: (offset(rg.end) - offset(rg.start) + 1) * COL - 2 }}
                >
                  <span className="truncate">{r.title || t.untitled}</span>
                </Link>
              )}
              {!rg && <span className="px-2 text-[12px] text-ink-3">{t.noDate}</span>}
            </div>
          </div>
        ))}
        <button type="button" data-testid="add-row" onClick={() => void db.addRow({ properties: { [dp.id]: { start: todayIso } } })} className="flex h-[30px] items-center gap-2 px-2 text-[14px] text-ink-3 hover:bg-hover">
          <Plus size={14} /> {t.newPage}
        </button>
      </div>
    </div>
  );
}
