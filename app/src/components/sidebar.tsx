"use client";

import {
  ChevronRight,
  Home,
  MoreHorizontal,
  Plus,
  SquarePen,
  Star,
  StarOff,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { t } from "@/lib/strings";
import { childrenOf, pathTo, type TreePage } from "@/lib/tree";
import { PageIcon } from "./page-icon";
import { PopoverMenu } from "./popover-menu";
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
  "group/row relative flex h-[27px] items-center gap-1 rounded-[6px] pr-1 text-[14px] text-ink-2 hover:bg-hover";

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
  const { pages, createPage, toggleFavorite, moveToTrash } = useWorkspace();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const kids = childrenOf(pages, page.id);
  const open = expanded.has(page.id);
  const active = activeId === page.id;

  return (
    <li>
      <div
        className={`${rowBase} ${active ? "bg-active font-medium text-ink" : ""}`}
        style={{ paddingLeft: 6 + depth * 14 }}
        data-testid="sidebar-page"
      >
        <button
          aria-label={open ? t.collapse : t.expand}
          aria-expanded={open}
          onClick={() => toggle(page.id)}
          className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-active"
        >
          <ChevronRight
            size={14}
            className={`text-ink-3 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
          />
        </button>
        <Link href={`/${page.id}`} className="flex min-w-0 flex-1 items-center gap-1.5 self-stretch">
          <span className="flex size-5 shrink-0 items-center justify-center">
            <PageIcon icon={page.icon} />
          </span>
          <span className="truncate">{page.title || t.untitled}</span>
        </Link>
        <div className="relative flex items-center opacity-0 group-hover/row:opacity-100 focus-within:opacity-100">
          <button
            aria-label={t.more}
            onClick={() => setMenu((m) => !m)}
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
          {menu && (
            <PopoverMenu
              className="absolute right-0 top-6"
              onClose={() => setMenu(false)}
              items={[
                {
                  label: page.isFavorite ? t.removeFavorite : t.addFavorite,
                  icon: page.isFavorite ? <StarOff size={14} /> : <Star size={14} />,
                  onSelect: () => void toggleFavorite(page.id),
                },
                {
                  label: t.moveToTrash,
                  icon: <Trash2 size={14} />,
                  danger: true,
                  onSelect: async () => {
                    const inside = activeId !== null && pathTo(pages, activeId).some((p) => p.id === page.id);
                    await moveToTrash(page.id);
                    if (inside) router.push("/");
                  },
                },
              ]}
            />
          )}
        </div>
      </div>
      {open && (
        <ul role="group">
          {kids.length === 0 ? (
            <li
              className="h-[27px] text-[13px] leading-[27px] text-ink-3"
              style={{ paddingLeft: 6 + (depth + 1) * 14 + 26 }}
            >
              {t.noSubpages}
            </li>
          ) : (
            kids.map((k) => (
              <SidebarNode key={k.id} page={k} depth={depth + 1} expanded={expanded} toggle={toggle} activeId={activeId} />
            ))
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
        className={`${rowBase} pl-[26px] ${active ? "bg-active font-medium text-ink" : ""}`}
        data-testid="favorite-page"
      >
        <span className="flex size-5 shrink-0 items-center justify-center">
          <PageIcon icon={page.icon} />
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
      className="absolute bottom-10 left-2 z-50 flex max-h-[420px] w-[360px] flex-col rounded-md bg-white text-sm shadow-[var(--shadow-pop)]"
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

export function Sidebar() {
  const { pages, loaded, createPage } = useWorkspace();
  const params = useParams<{ pageId?: string }>();
  const router = useRouter();
  const activeId = params.pageId ?? null;
  const { expanded, toggle } = useExpanded();
  const [trashOpen, setTrashOpen] = useState(false);

  // Expande los ancestros de la página activa para que sea visible.
  useEffect(() => {
    if (!activeId) return;
    for (const p of pathTo(pages, activeId).slice(0, -1)) toggle(p.id, true);
  }, [activeId, pages, toggle]);

  const roots = childrenOf(pages, null);
  const favorites = pages.filter((p) => p.isFavorite);
  const newRootPage = async () => router.push(`/${await createPage(null)}`);

  return (
    <aside className="relative flex h-full w-[240px] shrink-0 flex-col bg-sidebar text-ink" aria-label={t.sidebar}>
      <div className="flex h-[45px] items-center gap-2 px-3">
        <span className="flex size-[22px] items-center justify-center rounded bg-ink text-[13px] font-semibold text-white">
          N
        </span>
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

      <nav className="nd-scroll flex-1 overflow-y-auto px-[6px] pb-2" aria-label={t.pagesNav}>
        <Link href="/" className={`${rowBase} mb-2 pl-[8px] ${activeId === null ? "bg-active font-medium text-ink" : ""}`}>
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
            <button
              aria-label={t.addPage}
              title={t.addPage}
              onClick={newRootPage}
              className="flex size-5 items-center justify-center rounded opacity-0 hover:bg-active focus-visible:opacity-100 group-hover/h:opacity-100"
            >
              <Plus size={14} className="text-ink-2" />
            </button>
          </div>
          <ul role="tree">
            {roots.map((p) => (
              <SidebarNode key={p.id} page={p} depth={0} expanded={expanded} toggle={toggle} activeId={activeId} />
            ))}
          </ul>
          {loaded && roots.length === 0 && (
            <button onClick={newRootPage} className={`${rowBase} w-full pl-[8px] text-ink-3`}>
              <Plus size={14} className="mr-1.5" />
              {t.addPage}
            </button>
          )}
        </section>
      </nav>

      <div className="border-t border-line px-[6px] py-1.5">
        <button
          onClick={() => setTrashOpen((o) => !o)}
          className={`${rowBase} w-full pl-[8px]`}
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
