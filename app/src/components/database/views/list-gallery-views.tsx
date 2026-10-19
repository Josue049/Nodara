"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import type { FileValue, PropertyDef, RecordRow } from "@/lib/collections/types";
import { t } from "@/lib/strings";
import { PageIcon } from "../../page-icon";
import { CellValue, Tag } from "../cells";
import type { Database } from "../use-database";
import { visibleProps } from "./table-view";

const hasValue = (v: unknown) => !(v === null || v === undefined || v === "" || v === false || (Array.isArray(v) && v.length === 0));

function groupLabel(db: Database, key: string, label: string) {
  const gp = db.props.find((p) => p.id === db.view?.config.group?.propertyId);
  const opt = gp?.config.options?.find((o) => o.id === key);
  return opt ? <Tag option={opt} status={gp?.type === "status"} /> : <span className="font-medium text-ink-2">{key === "true" ? "Marcado" : key === "false" ? "Sin marcar" : label || t.noValue}</span>;
}

function ListRow({ db, row, props }: { db: Database; row: RecordRow; props: PropertyDef[] }) {
  return (
    <div data-testid="list-row" data-row-id={row.id} className="group flex min-h-[34px] items-center gap-2 rounded-md px-2 hover:bg-hover">
      <Link href={`/${row.id}`} className="flex min-w-0 flex-1 items-center gap-2 py-1 font-medium">
        <PageIcon icon={row.icon} size={16} />
        <span className={`truncate ${row.title ? "" : "text-ink-3"}`}>{row.title || t.untitled}</span>
      </Link>
      <div className="flex shrink-0 items-center gap-3 text-[14px] text-ink-2">
        {props.filter((p) => hasValue(row.values[p.id])).map((p) => (
          <span key={p.id} className="max-w-[200px] truncate" title={p.name}>
            <CellValue prop={p} value={row.values[p.id]} ctx={db.ctx} />
          </span>
        ))}
      </div>
    </div>
  );
}

export function ListView({ db }: { db: Database }) {
  const props = visibleProps(db);
  const byId = new Map(db.rows.map((r) => [r.id, r]));
  const sections = db.groups ?? [{ key: "__all__", label: "", rowIds: db.rows.map((r) => r.id) }];
  const gp = db.props.find((p) => p.id === db.view?.config.group?.propertyId);
  return (
    <div data-testid="list-view" className="pb-4">
      {sections.map((g) => (
        <div key={g.key} data-testid="group" data-group={g.key}>
          {db.groups && <div className="flex h-[32px] items-center gap-2 px-2">{groupLabel(db, g.key, g.label)}<span className="text-[14px] text-ink-3">{g.rowIds.length}</span></div>}
          {g.rowIds.map((id) => byId.get(id)).filter((r): r is RecordRow => !!r).map((r) => (
            <ListRow key={r.id} db={db} row={r} props={props.filter((p) => p.id !== gp?.id)} />
          ))}
          {db.canEdit && <button
            type="button"
            data-testid="add-row"
            onClick={() => void db.addRow({ properties: gp && g.key !== "__all__" && g.key !== "__empty__" ? { [gp.id]: gp.type === "multi_select" ? [g.key] : gp.type === "checkbox" ? g.key === "true" : g.key } : {} })}
            className="flex h-[30px] items-center gap-2 rounded-md px-2 text-[14px] text-ink-3 hover:bg-hover"
          >
            <Plus size={14} /> {t.newPage}
          </button>}
        </div>
      ))}
    </div>
  );
}

const CARD_MIN = { small: 160, medium: 250, large: 340 } as const;
const IMG = /\.(png|jpe?g|gif|webp)$/i;

function cover(db: Database, row: RecordRow): string | null {
  for (const p of db.props) {
    if (p.type !== "files") continue;
    const f = ((row.values[p.id] as FileValue[]) ?? []).find((x) => IMG.test(x.name));
    if (f) return f.url;
  }
  return null;
}

export function GalleryView({ db }: { db: Database }) {
  const props = visibleProps(db);
  const size = db.view?.config.cardSize ?? "medium";
  const byId = new Map(db.rows.map((r) => [r.id, r]));
  const sections = db.groups ?? [{ key: "__all__", label: "", rowIds: db.rows.map((r) => r.id) }];
  return (
    <div data-testid="gallery-view" className="flex flex-col gap-4 pb-4">
      {sections.map((g) => (
        <div key={g.key} data-testid="group" data-group={g.key}>
          {db.groups && <div className="mb-2 flex h-[28px] items-center gap-2">{groupLabel(db, g.key, g.label)}<span className="text-[14px] text-ink-3">{g.rowIds.length}</span></div>}
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${CARD_MIN[size]}px, 1fr))` }}>
            {g.rowIds.map((id) => byId.get(id)).filter((r): r is RecordRow => !!r).map((r) => {
              const img = cover(db, r);
              return (
                <Link key={r.id} href={`/${r.id}`} data-testid="gallery-card" data-row-id={r.id} className="overflow-hidden rounded-lg border border-line bg-[var(--bg)] shadow-sm hover:bg-hover/50">
                  <div className="flex h-[120px] items-center justify-center bg-hover/60">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt="" className="size-full object-cover" />
                    ) : (
                      <PageIcon icon={r.icon} size={32} />
                    )}
                  </div>
                  <div className="flex flex-col gap-1 p-2.5">
                    <span className={`flex items-center gap-1.5 font-medium ${r.title ? "" : "text-ink-3"}`}>
                      <PageIcon icon={r.icon} size={16} />
                      <span className="truncate">{r.title || t.untitled}</span>
                    </span>
                    {props.filter((p) => hasValue(r.values[p.id])).map((p) => (
                      <div key={p.id} className="min-w-0 text-[14px]">
                        <CellValue prop={p} value={r.values[p.id]} ctx={db.ctx} />
                      </div>
                    ))}
                  </div>
                </Link>
              );
            })}
            {db.canEdit && <button
              type="button"
              data-testid="add-row"
              onClick={() => void db.addRow()}
              className="flex min-h-[120px] items-center justify-center gap-2 rounded-lg border border-dashed border-line text-[14px] text-ink-3 hover:bg-hover"
            >
              <Plus size={14} /> {t.newPage}
            </button>}
          </div>
        </div>
      ))}
    </div>
  );
}
