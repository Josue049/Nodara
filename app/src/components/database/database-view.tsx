"use client";

import {
  Calendar as CalendarIcon,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  Filter,
  GalleryVertical,
  GanttChart,
  LayoutList,
  List,
  Plus,
  Search,
  SlidersHorizontal,
  Table2,
  Trash2,
  ArrowDownUp,
  Columns3,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { VIEW_LABELS } from "@/lib/collections/format";
import { VIEW_TYPES, type TemplateDef, type ViewDef, type ViewType } from "@/lib/collections/types";
import { t } from "@/lib/strings";
import { dbApi } from "./api";
import { FilterPopover, SortPopover } from "./filter-sort";
import { anchorOf, MenuRow, Popover, type Anchor } from "./popover";
import { useDatabase, type Database } from "./use-database";
import { BoardView } from "./views/board-view";
import { CalendarView, TimelineView } from "./views/calendar-timeline-views";
import { GalleryView, ListView } from "./views/list-gallery-views";
import { TableView, visibleProps } from "./views/table-view";

const VIEW_ICONS: Record<ViewType, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>> = {
  table: Table2,
  board: Columns3,
  list: List,
  gallery: GalleryVertical,
  calendar: CalendarIcon,
  timeline: GanttChart,
};

const iconBtn = "relative flex size-7 items-center justify-center rounded-md text-ink-2 hover:bg-hover";

function ViewMenu({ db, view, anchor, onClose }: { db: Database; view: ViewDef; anchor: Anchor; onClose: () => void }) {
  const [name, setName] = useState(view.name);
  const [typesOpen, setTypesOpen] = useState(false);
  return (
    <Popover anchor={anchor} onClose={onClose} label="Opciones de la vista" testId="view-menu" width={260}>
      <div className="p-1">
        <input
          value={name}
          aria-label="Nombre de la vista"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== view.name && void db.updateView({ name: name.trim() })}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="mb-1 h-8 w-full rounded-md border border-line bg-transparent px-2 outline-none focus:border-accent"
        />
        <MenuRow onClick={() => setTypesOpen((o) => !o)} right={<ChevronDown size={14} />}>
          {t.showAs}
        </MenuRow>
        {typesOpen &&
          VIEW_TYPES.map((v) => (
            <MenuRow key={v} active={v === view.type} icon={<ViewIcon type={v} />} onClick={() => (onClose(), void db.updateView({ type: v }))}>
              {VIEW_LABELS[v]}
            </MenuRow>
          ))}
        <MenuRow icon={<Copy size={14} />} onClick={() => (onClose(), void db.duplicateView(view.id))} testId="duplicate-view">
          {t.duplicateView}
        </MenuRow>
        {(db.bundle?.views.length ?? 0) > 1 && (
          <MenuRow icon={<Trash2 size={14} />} danger onClick={() => (onClose(), void db.deleteView(view.id))} testId="delete-view">
            {t.deleteView}
          </MenuRow>
        )}
      </div>
    </Popover>
  );
}

function ViewIcon({ type, size = 14 }: { type: ViewType; size?: number }) {
  const I = VIEW_ICONS[type];
  return <I size={size} strokeWidth={1.7} className="shrink-0" />;
}

function SettingsPopover({ db, anchor, onClose, openFilter, openSort }: { db: Database; anchor: Anchor; onClose: () => void; openFilter: () => void; openSort: () => void }) {
  const view = db.view!;
  const cfg = view.config;
  const shown = visibleProps(db);
  const hidden = db.props.filter((p) => !shown.some((s) => s.id === p.id));
  const setVisible = (ids: string[]) => void db.updateViewConfig({ visibleProperties: ids });
  const groupable = db.props.filter((p) => ["select", "status", "multi_select", "checkbox", "text", "number", "date"].includes(p.type));
  const dates = db.props.filter((p) => p.type === "date");
  const toggle = (label: string, value: boolean, onChange: (v: boolean) => void) => (
    <label className="flex h-[30px] items-center justify-between px-2">
      {label}
      <input type="checkbox" role="switch" aria-label={label} checked={value} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--accent)]" />
    </label>
  );
  return (
    <Popover anchor={anchor} onClose={onClose} label={t.viewSettings} testId="view-settings" width={340} align="right">
      <div className="flex flex-col gap-1 p-1">
        {db.canEdit && <p className="px-2 pt-1 text-[12px] font-medium text-ink-3">{t.layout}</p>}
        {db.canEdit && <div className="grid grid-cols-3 gap-1.5 px-1 pb-1">
          {VIEW_TYPES.map((v) => (
            <button
              key={v}
              type="button"
              data-testid={`layout-${v}`}
              aria-pressed={view.type === v}
              onClick={() => void db.updateView({ type: v })}
              className={`flex flex-col items-center gap-1 rounded-md border px-1 py-2 text-[12px] hover:bg-hover ${view.type === v ? "border-accent text-accent" : "border-line text-ink-2"}`}
            >
              <ViewIcon type={v} size={18} />
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>}

        <MenuRow icon={<Filter size={14} />} onClick={() => (onClose(), openFilter())} right={cfg.filter?.conditions.length || ""}>
          {t.filter}
        </MenuRow>
        <MenuRow icon={<ArrowDownUp size={14} />} onClick={() => (onClose(), openSort())} right={cfg.sorts?.length || ""}>
          {t.sort}
        </MenuRow>

        <p className="px-2 pt-2 text-[12px] font-medium text-ink-3">{t.groupBy}</p>
        <div className="px-2">
          <select
            aria-label={t.groupBy}
            value={cfg.group?.propertyId ?? ""}
            onChange={(e) => void db.updateViewConfig({ group: e.target.value ? { propertyId: e.target.value } : null })}
            className="h-8 w-full rounded-md border border-line bg-transparent px-2"
          >
            <option value="">{t.noGrouping}</option>
            {groupable.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {cfg.group && toggle(t.hideEmptyGroups, cfg.group.hideEmpty === true, (v) => void db.updateViewConfig({ group: { ...cfg.group!, hideEmpty: v } }))}

        <p className="px-2 pt-2 text-[12px] font-medium text-ink-3">{t.propertyVisibility}</p>
        {shown.map((p) => (
          <MenuRow key={p.id} icon={<Eye size={14} />} onClick={() => setVisible(shown.filter((x) => x.id !== p.id).map((x) => x.id))} testId="prop-visible">
            {p.name}
          </MenuRow>
        ))}
        {hidden.map((p) => (
          <MenuRow key={p.id} icon={<EyeOff size={14} />} onClick={() => setVisible([...shown.map((x) => x.id), p.id])} testId="prop-hidden">
            <span className="text-ink-3">{p.name}</span>
          </MenuRow>
        ))}

        {view.type === "table" && (
          <>
            <p className="px-2 pt-2 text-[12px] font-medium text-ink-3">{t.tableOptions}</p>
            {toggle(t.verticalLines, cfg.showVerticalLines !== false, (v) => void db.updateViewConfig({ showVerticalLines: v }))}
            {toggle(t.pageIcon, cfg.showPageIcon !== false, (v) => void db.updateViewConfig({ showPageIcon: v }))}
            {toggle(t.wrapAll, cfg.wrapCells === true, (v) => void db.updateViewConfig({ wrapCells: v }))}
          </>
        )}
        {view.type === "gallery" && (
          <div className="px-2 pt-2">
            <label className="flex items-center justify-between">
              {t.cardSize}
              <select aria-label={t.cardSize} value={cfg.cardSize ?? "medium"} onChange={(e) => void db.updateViewConfig({ cardSize: e.target.value as "small" | "medium" | "large" })} className="h-8 rounded-md border border-line bg-transparent px-2">
                <option value="small">Pequeña</option>
                <option value="medium">Mediana</option>
                <option value="large">Grande</option>
              </select>
            </label>
          </div>
        )}
        {(view.type === "calendar" || view.type === "timeline") && (
          <div className="px-2 pt-2">
            <label className="flex items-center justify-between">
              {t.dateProperty}
              <select aria-label={t.dateProperty} value={cfg.dateProperty ?? dates[0]?.id ?? ""} onChange={(e) => void db.updateViewConfig({ dateProperty: e.target.value })} className="h-8 rounded-md border border-line bg-transparent px-2">
                {dates.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>
    </Popover>
  );
}

function TemplateMenu({ db, anchor, onClose, onCreated }: { db: Database; anchor: Anchor; onClose: () => void; onCreated: (id: string) => void }) {
  const [templates, setTemplates] = useState<TemplateDef[] | null>(null);
  const cid = db.bundle?.collection.id ?? "";
  useEffect(() => {
    void dbApi.templates(cid).then(setTemplates);
  }, [cid]);
  return (
    <Popover anchor={anchor} onClose={onClose} label={t.templates} testId="template-menu" width={260} align="right">
      <MenuRow icon={<Plus size={14} />} onClick={async () => (onClose(), onCreated(await db.addRow()))} testId="blank-row">
        {t.blankPage}
      </MenuRow>
      <p className="px-2 pt-2 text-[12px] font-medium text-ink-3">{t.templates}</p>
      {templates?.length === 0 && <p className="px-2 py-1 text-ink-3">{t.noTemplates}</p>}
      {templates?.map((tp) => (
        <div key={tp.id} className="group flex items-center">
          <div className="flex-1">
            <MenuRow onClick={async () => (onClose(), onCreated(await db.addRow({ templateId: tp.id })))} testId="template-item">
              {tp.name}
            </MenuRow>
          </div>
          <button type="button" aria-label={`${t.deleteTemplate} ${tp.name}`} onClick={async () => (await dbApi.deleteTemplate(tp.id), setTemplates((l) => l?.filter((x) => x.id !== tp.id) ?? null))} className="mr-1 rounded p-1 text-ink-3 opacity-0 hover:bg-active group-hover:opacity-100 focus-visible:opacity-100">
            <X size={14} />
          </button>
        </div>
      ))}
    </Popover>
  );
}

function InlineTitle({ db }: { db: Database }) {
  const c = db.bundle!.collection;
  const [title, setTitle] = useState(c.title);
  return (
    <input
      value={title}
      aria-label={t.databaseTitle}
      placeholder={t.database}
      data-testid="inline-db-title"
      onChange={(e) => setTitle(e.target.value)}
      onBlur={() => title !== c.title && void dbApi.updateCollection(c.id, { title }).then(() => db.reload())}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className="mb-1 w-full bg-transparent text-[20px] font-semibold outline-none placeholder:text-ink-3"
    />
  );
}

export function DatabaseView({ collectionId, inline = false, header }: { collectionId: string; inline?: boolean; header?: React.ReactNode }) {
  const db = useDatabase(collectionId);
  const [pop, setPop] = useState<{ kind: "filter" | "sort" | "settings" | "view" | "addview" | "templates"; anchor: Anchor } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const filterBtn = useRef<HTMLButtonElement>(null);
  const sortBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  if (db.error && !db.data) return <p role="alert" className="py-4 text-danger">{db.error}</p>;
  if (!db.bundle || !db.view) return <div className="h-24" aria-busy data-testid="database-loading" />;

  const view = db.view;
  const views = db.bundle.views;
  const filterCount = view.config.filter?.conditions.length ?? 0;
  const sortCount = view.config.sorts?.length ?? 0;
  const open = (kind: NonNullable<typeof pop>["kind"], el: Element) => setPop({ kind, anchor: anchorOf(el) });

  const newRow = async () => {
    await db.addRow();
  };

  return (
    <div data-testid="database" data-collection={collectionId} data-view-type={view.type} className="relative">
      {header}
      {inline && <InlineTitle db={db} />}
      <div className="flex min-h-[40px] items-center gap-1 pb-1" data-testid="db-toolbar">
        <div role="tablist" aria-label={t.views} className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {views.map((v) => {
            const activeTab = v.id === view.id;
            return (
              <div key={v.id} className="flex shrink-0 items-center">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab}
                  data-testid="view-tab"
                  data-view-id={v.id}
                  onClick={(e) => (activeTab && db.canEdit ? open("view", e.currentTarget) : db.selectView(v.id))}
                  className={`flex h-[30px] items-center gap-1.5 rounded-full px-2.5 text-[14px] ${activeTab ? "bg-active font-medium text-ink" : "text-ink-2 hover:bg-hover"}`}
                >
                  <ViewIcon type={v.type} />
                  {v.name}
                </button>
              </div>
            );
          })}
          {db.canEdit && <button type="button" aria-label={t.addView} data-testid="add-view" onClick={(e) => open("addview", e.currentTarget)} className={iconBtn}>
            <Plus size={16} />
          </button>}
        </div>

        <button ref={filterBtn} type="button" aria-label={t.filter} data-testid="filter-btn" onClick={(e) => open("filter", e.currentTarget)} className={`${iconBtn} ${filterCount ? "text-accent" : ""}`}>
          <Filter size={16} />
          {filterCount > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-accent px-1 text-[10px] leading-4 text-white">{filterCount}</span>}
        </button>
        <button ref={sortBtn} type="button" aria-label={t.sort} data-testid="sort-btn" onClick={(e) => open("sort", e.currentTarget)} className={`${iconBtn} ${sortCount ? "text-accent" : ""}`}>
          <ArrowDownUp size={16} />
          {sortCount > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-accent px-1 text-[10px] leading-4 text-white">{sortCount}</span>}
        </button>
        {searchOpen ? (
          <div className="flex h-7 items-center gap-1 rounded-md border border-line px-1.5">
            <Search size={14} className="text-ink-3" />
            <input
              ref={searchRef}
              value={db.search}
              onChange={(e) => db.setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && (db.setSearch(""), setSearchOpen(false))}
              onBlur={() => !db.search && setSearchOpen(false)}
              placeholder={t.searchRows}
              aria-label={t.searchRows}
              data-testid="db-search"
              className="w-[160px] bg-transparent text-[14px] outline-none"
            />
          </div>
        ) : (
          <button type="button" aria-label={t.searchRows} data-testid="search-btn" onClick={() => setSearchOpen(true)} className={iconBtn}>
            <Search size={16} />
          </button>
        )}
        <button type="button" aria-label={t.viewSettings} data-testid="settings-btn" onClick={(e) => open("settings", e.currentTarget)} className={iconBtn}>
          <SlidersHorizontal size={16} />
        </button>
        {db.canEdit && <div className="ml-1 flex h-7 items-stretch overflow-hidden rounded-md bg-accent text-white">
          <button type="button" data-testid="new-btn" onClick={newRow} className="px-3 text-[14px] font-medium hover:brightness-95">
            {t.new}
          </button>
          <button type="button" aria-label={t.moreOptions} data-testid="templates-btn" onClick={(e) => open("templates", e.currentTarget)} className="border-l border-white/30 px-1.5 hover:brightness-95">
            <ChevronDown size={14} />
          </button>
        </div>}
      </div>

      <div className="pt-1" data-testid="db-body">
        {view.type === "table" && <TableView db={db} />}
        {view.type === "board" && <BoardView db={db} />}
        {view.type === "list" && <ListView db={db} />}
        {view.type === "gallery" && <GalleryView db={db} />}
        {view.type === "calendar" && <CalendarView db={db} />}
        {view.type === "timeline" && <TimelineView db={db} />}
        {db.rows.length === 0 && db.search && <p className="py-3 text-ink-3" data-testid="no-results">{t.noResults}</p>}
      </div>

      {pop?.kind === "filter" && <FilterPopover anchor={pop.anchor} db={db} onClose={() => setPop(null)} />}
      {pop?.kind === "sort" && <SortPopover anchor={pop.anchor} db={db} onClose={() => setPop(null)} />}
      {pop?.kind === "settings" && (
        <SettingsPopover
          db={db}
          anchor={pop.anchor}
          onClose={() => setPop(null)}
          openFilter={() => filterBtn.current && open("filter", filterBtn.current)}
          openSort={() => sortBtn.current && open("sort", sortBtn.current)}
        />
      )}
      {pop?.kind === "view" && <ViewMenu db={db} view={view} anchor={pop.anchor} onClose={() => setPop(null)} />}
      {pop?.kind === "addview" && (
        <Popover anchor={pop.anchor} onClose={() => setPop(null)} label={t.addView} testId="add-view-menu" width={220}>
          {VIEW_TYPES.map((v) => (
            <MenuRow key={v} icon={<LayoutList size={0} className="hidden" />} onClick={() => (setPop(null), void db.addView(v))} testId={`add-view-${v}`}>
              <span className="flex items-center gap-2">
                <ViewIcon type={v} />
                {VIEW_LABELS[v]}
              </span>
            </MenuRow>
          ))}
        </Popover>
      )}
      {pop?.kind === "templates" && <TemplateMenu db={db} anchor={pop.anchor} onClose={() => setPop(null)} onCreated={() => {}} />}
    </div>
  );
}
