"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ChevronRight, Home, Table2, MoreHorizontal, Moon, Plus, Search, SquarePen, Trash2, Undo2, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { t } from "@/lib/strings";
import { THEME_KEY, resolveTheme, type ThemeChoice } from "@/lib/theme";
import { childrenOf, pathTo, type TreePage } from "@/lib/tree";
import { PageIcon } from "./page-icon";
import { PopoverMenu } from "./popover-menu";
import { usePageMenu } from "./use-page-menu";
import { useWorkspace } from "./workspace-provider";

const EXPANDED_KEY = "nodara:expanded";

function useExpanded() {
  // Las páginas llegan por fetch tras montar, así que leer localStorage aquí no desajusta la hidratación.
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    try {
      const raw = typeof window === "undefined" ? null : localStorage.getItem(EXPANDED_KEY);
      return new Set<string>(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set<string>();
    }
  });
  const toggle = useCallback((id: string, force?: boolean) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      const open = force ?? !next.has(id);
      if (open) next.add(id);
      else next.delete(id);
      try {
        localStorage.setItem(EXPANDED_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }, []);
  return { expanded, toggle };
}

const rowBase =
  "group/row relative flex h-[30px] items-center gap-1 rounded-[6px] pr-1 text-[16px] font-medium text-ink-2 hover:bg-hover";

type DropPos = "before" | "inside" | "after";
type Drop = { id: string; pos: DropPos } | null;
const DropContext = createContext<Drop>(null);

function RenameInput({ page, onDone }: { page: TreePage; onDone: () => void }) {
  const { updatePage } = useWorkspace();
  const [value, setValue] = useState(page.title);
  const done = useRef(false);
  const commit = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    if (save && value !== page.title) void updatePage(page.id, { title: value });
    onDone();
  };
  return (
    <input
      autoFocus
      aria-label={t.rename}
      value={value}
      placeholder={t.untitled}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => commit(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit(true);
        else if (e.key === "Escape") commit(false);
      }}
      className="min-w-0 flex-1 rounded border border-accent bg-[var(--bg)] px-1 text-[16px] font-medium text-ink outline-none"
    />
  );
}

function SidebarNode({
  page,
  depth,
  expanded,
  toggle,
  activeId,
}: {
  page: TreePage;
  depth: number;
  expanded: Set<string>;
  toggle: (id: string, force?: boolean) => void;
  activeId: string | null;
}) {
  const { pages, createPage, renaming, setRenaming } = useWorkspace();
  const { itemsFor } = usePageMenu(activeId);
  const drop = useContext(DropContext);
  const router = useRouter();
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  const { setNodeRef: dragRef, listeners, isDragging } = useDraggable({ id: page.id });
  const { setNodeRef: dropRef } = useDroppable({ id: page.id });
  const kids = childrenOf(pages, page.id);
  const open = expanded.has(page.id);
  const active = activeId === page.id;
  const target = drop?.id === page.id ? drop.pos : null;

  return (
    <li>
      <div
        ref={(el) => {
          dragRef(el);
          dropRef(el);
        }}
        {...listeners}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenuAt({ x: e.clientX, y: e.clientY });
        }}
        className={`${rowBase} ${active ? "bg-active text-ink" : ""} ${isDragging ? "opacity-40" : ""} ${target === "inside" ? "bg-accent/15 ring-1 ring-accent" : ""}`}
        style={{ paddingLeft: 6 + depth * 14 }}
        data-testid="sidebar-page"
        data-page-id={page.id}
      >
        {target === "before" && <span className="pointer-events-none absolute inset-x-1 -top-px h-0.5 rounded bg-accent" />}
        {target === "after" && <span className="pointer-events-none absolute inset-x-1 -bottom-px h-0.5 rounded bg-accent" />}
        <button
          aria-label={open ? t.collapse : t.expand}
          aria-expanded={open}
          onClick={() => toggle(page.id)}
          className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-active"
        >
          <ChevronRight size={14} className={`text-ink-3 transition-transform duration-150 ${open ? "rotate-90" : ""}`} />
        </button>
        {renaming === page.id ? (
          <>
            <span className="flex size-5 shrink-0 items-center justify-center">
              <PageIcon icon={page.icon} kind={page.kind} />
            </span>
            <RenameInput page={page} onDone={() => setRenaming(null)} />
          </>
        ) : (
          <Link href={`/${page.id}`} draggable={false} className="flex min-w-0 flex-1 items-center gap-1.5 self-stretch">
            <span className="flex size-5 shrink-0 items-center justify-center">
              <PageIcon icon={page.icon} kind={page.kind} />
            </span>
            <span className="truncate">{page.title || t.untitled}</span>
          </Link>
        )}
        <div className="flex items-center opacity-0 group-hover/row:opacity-100 focus-within:opacity-100">
          <button
            aria-label={t.more}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setMenuAt({ x: r.left, y: r.bottom + 4 });
            }}
            className="flex size-5 items-center justify-center rounded hover:bg-active"
          >
            <MoreHorizontal size={14} />
          </button>
          <button
            aria-label={t.addSubpage}
            title={t.addSubpage}
            onClick={async () => {
              const id = await createPage(page.id);
              toggle(page.id, true);
              router.push(`/${id}`);
            }}
            className="flex size-5 items-center justify-center rounded hover:bg-active"
          >
            <Plus size={14} />
          </button>
        </div>
        {menuAt && <PopoverMenu at={menuAt} onClose={() => setMenuAt(null)} items={itemsFor(page)} />}
      </div>
      {open && (
        <ul role="group">
          {kids.length === 0 ? (
            <li className="h-[30px] text-[14px] leading-[30px] text-ink-3" style={{ paddingLeft: 6 + (depth + 1) * 14 + 26 }}>
              {t.noSubpages}
            </li>
          ) : (
            kids.map((k) => <SidebarNode key={k.id} page={k} depth={depth + 1} expanded={expanded} toggle={toggle} activeId={activeId} />)
          )}
        </ul>
      )}
    </li>
  );
}

function FavoriteRow({ page, active }: { page: TreePage; active: boolean }) {
  return (
    <li>
      <Link
        href={`/${page.id}`}
        className={`${rowBase} pl-[26px] ${active ? "bg-active text-ink" : ""}`}
        data-testid="favorite-page"
      >
        <span className="flex size-5 shrink-0 items-center justify-center">
          <PageIcon icon={page.icon} kind={page.kind} />
        </span>
        <span className="truncate">{page.title || t.untitled}</span>
      </Link>
    </li>
  );
}

function TrashPanel({ onClose }: { onClose: () => void }) {
  const { trash, refreshTrash, restore, deleteForever } = useWorkspace();
  useEffect(() => {
    void refreshTrash();
  }, [refreshTrash]);
  return (
    <div
      role="dialog"
      aria-label={t.trash}
      className="absolute bottom-10 left-2 z-50 flex max-h-[420px] w-[360px] flex-col rounded-[10px] bg-[var(--popover)] text-sm shadow-[var(--shadow-pop)]"
    >
      <div className="flex items-center justify-between border-b border-line px-3 py-2 font-medium">
        {t.trash}
        <button aria-label={t.close} onClick={onClose} className="rounded p-0.5 hover:bg-hover">
          <X size={14} />
        </button>
      </div>
      <ul className="nd-scroll overflow-y-auto p-1">
        {trash.length === 0 && <li className="px-3 py-6 text-center text-ink-3">{t.emptyTrash}</li>}
        {trash.map((p) => (
          <li key={p.id} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-hover" data-testid="trash-item">
            <PageIcon icon={p.icon} />
            <span className="min-w-0 flex-1 truncate">{p.title || t.untitled}</span>
            <button aria-label={t.restore} title={t.restore} onClick={() => void restore(p.id)} className="rounded p-1 hover:bg-active">
              <Undo2 size={14} />
            </button>
            <button
              aria-label={t.deleteForever}
              title={t.deleteForever}
              onClick={() => void deleteForever(p.id)}
              className="rounded p-1 text-danger hover:bg-active"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ThemeToggle() {
  const toggle = () => {
    const next: ThemeChoice = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
    document.documentElement.dataset.theme = resolveTheme(next);
  };
  return (
    <button onClick={toggle} className={`${rowBase} w-full pl-[8px] font-normal`} data-testid="theme-toggle">
      <Moon size={16} className="mr-1.5" />
      {t.toggleTheme}
    </button>
  );
}

export function Sidebar() {
  const { pages, loaded, createPage, createDatabase, movePage, setSearchOpen } = useWorkspace();
  const params = useParams<{ pageId?: string }>();
  const router = useRouter();
  const activeId = params.pageId ?? null;
  const { expanded, toggle } = useExpanded();
  const [trashOpen, setTrashOpen] = useState(false);
  const [drop, setDrop] = useState<Drop>(null);
  const [dragging, setDragging] = useState<TreePage | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Expande los ancestros de la página activa para que sea visible.
  useEffect(() => {
    if (!activeId) return;
    for (const p of pathTo(pages, activeId).slice(0, -1)) toggle(p.id, true);
  }, [activeId, pages, toggle]);

  const roots = childrenOf(pages, null);
  const favorites = pages.filter((p) => p.isFavorite);
  const newRootPage = async () => router.push(`/${await createPage(null)}`);
  const newRootDatabase = async () => router.push(`/${await createDatabase(null)}`);

  // Descendientes de la página arrastrada: no son destinos válidos.
  const blocked = useMemo(() => {
    const out = new Set<string>();
    if (!dragging) return out;
    out.add(dragging.id);
    let grew = true;
    while (grew) {
      grew = false;
      for (const p of pages) {
        if (p.parentId && out.has(p.parentId) && !out.has(p.id)) {
          out.add(p.id);
          grew = true;
        }
      }
    }
    return out;
  }, [dragging, pages]);

  const onDragStart = (e: DragStartEvent) => setDragging(pages.find((p) => p.id === e.active.id) ?? null);
  const onDragMove = (e: DragMoveEvent) => {
    const { over, activatorEvent, delta } = e;
    if (!over || blocked.has(String(over.id))) return setDrop(null);
    const y = (activatorEvent as PointerEvent).clientY + delta.y;
    const rel = (y - over.rect.top) / over.rect.height;
    const pos: DropPos = rel < 0.28 ? "before" : rel > 0.72 ? "after" : "inside";
    setDrop((d) => (d?.id === over.id && d.pos === pos ? d : { id: String(over.id), pos }));
  };
  const onDragEnd = async (e: DragEndEvent) => {
    const current = drop;
    setDrop(null);
    setDragging(null);
    if (!current) return;
    const id = String(e.active.id);
    const target = pages.find((p) => p.id === current.id);
    if (!target) return;
    const siblings = (parentId: string | null) => childrenOf(pages, parentId).filter((p) => p.id !== id);
    if (current.pos === "inside") {
      toggle(target.id, true);
      await movePage(id, target.id, siblings(target.id).length);
    } else {
      const list = siblings(target.parentId);
      const at = list.findIndex((p) => p.id === target.id);
      await movePage(id, target.parentId, current.pos === "before" ? at : at + 1);
    }
  };

  return (
    <aside className="relative flex h-full w-[var(--sidebar-w)] shrink-0 flex-col bg-sidebar text-ink" aria-label={t.sidebar}>
      <div className="flex h-[45px] items-center gap-2 px-3">
        <span className="flex size-[22px] items-center justify-center rounded bg-ink text-[13px] font-semibold text-[var(--bg)]">N</span>
        <span className="truncate text-[14px] font-medium">Nodara</span>
        <button
          aria-label={t.newPage}
          title={t.newPage}
          onClick={newRootPage}
          className="ml-auto flex size-7 items-center justify-center rounded hover:bg-hover"
        >
          <SquarePen size={16} className="text-ink-2" />
        </button>
      </div>

      <nav className="nd-scroll flex-1 overflow-y-auto px-[8px] pb-2" aria-label={t.pagesNav}>
        <button onClick={() => setSearchOpen(true)} className={`${rowBase} w-full pl-[8px] font-normal`} data-testid="open-search">
          <Search size={16} className="mr-1.5" />
          {t.search}
          <span className="ml-auto text-[12px] text-ink-3">Ctrl+K</span>
        </button>
        <Link href="/" className={`${rowBase} mb-2 pl-[8px] ${activeId === null ? "bg-active text-ink" : ""}`}>
          <Home size={16} className="mr-1.5" />
          {t.home}
        </Link>

        {favorites.length > 0 && (
          <section className="mb-3">
            <h2 className="px-[8px] py-1 text-[12px] font-medium text-ink-3">{t.favorites}</h2>
            <ul>
              {favorites.map((p) => (
                <FavoriteRow key={p.id} page={p} active={activeId === p.id} />
              ))}
            </ul>
          </section>
        )}

        <section>
          <div className="group/h flex items-center justify-between px-[8px] py-1">
            <h2 className="text-[12px] font-medium text-ink-3">{t.pages}</h2>
            <div className="flex items-center gap-0.5">
            <button
              aria-label={t.newDatabase}
              title={t.newDatabase}
              onClick={newRootDatabase}
              data-testid="new-database"
              className="flex size-5 items-center justify-center rounded opacity-0 hover:bg-active focus-visible:opacity-100 group-hover/h:opacity-100"
            >
              <Table2 size={14} className="text-ink-2" />
            </button>
            <button
              aria-label={t.addPage}
              title={t.addPage}
              onClick={newRootPage}
              className="flex size-5 items-center justify-center rounded opacity-0 hover:bg-active focus-visible:opacity-100 group-hover/h:opacity-100"
            >
              <Plus size={14} className="text-ink-2" />
            </button>
            </div>
          </div>
          <DndContext
            sensors={sensors}
            onDragStart={onDragStart}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
            onDragCancel={() => {
              setDrop(null);
              setDragging(null);
            }}
          >
            <DropContext.Provider value={drop}>
              <ul role="tree">
                {roots.map((p) => (
                  <SidebarNode key={p.id} page={p} depth={0} expanded={expanded} toggle={toggle} activeId={activeId} />
                ))}
              </ul>
            </DropContext.Provider>
            <DragOverlay dropAnimation={null}>
              {dragging && (
                <div className="flex h-[30px] w-[200px] items-center gap-1.5 rounded-[6px] bg-[var(--popover)] px-2 text-[16px] shadow-[var(--shadow-pop)]">
                  <PageIcon icon={dragging.icon} />
                  <span className="truncate">{dragging.title || t.untitled}</span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
          {loaded && roots.length === 0 && (
            <button onClick={newRootPage} className={`${rowBase} w-full pl-[8px] text-ink-3`}>
              <Plus size={14} className="mr-1.5" />
              {t.addPage}
            </button>
          )}
        </section>
      </nav>

      <div className="border-t border-line px-[8px] py-1.5">
        <ThemeToggle />
        <button
          onClick={() => setTrashOpen((o) => !o)}
          className={`${rowBase} w-full pl-[8px] font-normal`}
          aria-haspopup="dialog"
          aria-expanded={trashOpen}
        >
          <Trash2 size={16} className="mr-1.5" />
          {t.trash}
        </button>
      </div>
      {trashOpen && <TrashPanel onClose={() => setTrashOpen(false)} />}
    </aside>
  );
}
