"use client";

import { History, Link2, Lock, MessageSquare, MoreHorizontal, Star, Users } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { t } from "@/lib/strings";
import { pathTo } from "@/lib/tree";
import { SidebarToggle } from "./app-shell";
import { PageIcon } from "./page-icon";
import { anchorOf, MenuRow, Popover, type Anchor } from "./database/popover";
import { AnalyticsPanel } from "./analytics-panel";
import { PageMenu, type PageSettings } from "./page-menu";
import { ShareDialog } from "./share-dialog";
import { useWorkspace } from "./workspace-provider";
import { VersionHistory } from "./version-history";

export type SaveState = "idle" | "saving" | "saved" | "error";

type RecordInfo = { id: string; title: string; icon: string | null; parentId: string | null };

export function Topbar({
  pageId,
  saveState,
  record,
  level = "full",
  scope = "private",
  onAccessChanged,
  presence = [],
  offline = false,
  onToggleComments,
  commentsOpen = false,
  settings,
  onSettings,
  canUnlock = false,
  isDatabase = false,
  collectionId = null,
  title = "",
}: {
  settings?: PageSettings;
  onSettings?: (patch: Partial<PageSettings>) => void;
  canUnlock?: boolean;
  isDatabase?: boolean;
  collectionId?: string | null;
  title?: string;
  onToggleComments?: () => void;
  commentsOpen?: boolean;
  pageId: string;
  saveState: SaveState;
  record?: RecordInfo;
  level?: string;
  scope?: string;
  /** Se llama tras cambiar permisos o alcance desde «Compartir» (para recargar el nivel de acceso). */
  onAccessChanged?: () => void;
  /** Otras personas con la página abierta ahora mismo. */
  presence?: { id: string; name: string; color: string }[];
  /** Sin conexión con el servidor: los cambios se guardan localmente y se sincronizan al volver. */
  offline?: boolean;
}) {
  const { pages, toggleFavorite, refreshPages } = useWorkspace();
  const [share, setShare] = useState<Anchor | null>(null);
  const [more, setMore] = useState<Anchor | null>(null);
  const [history, setHistory] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareBtn = useRef<HTMLButtonElement>(null);
  // Los registros de bases de datos no están en el árbol: la ruta es la de su base más el propio registro.
  const trail = record
    ? [...(record.parentId ? pathTo(pages, record.parentId) : []), { id: record.id, title: record.title, icon: record.icon, parentId: record.parentId, position: 0, isFavorite: false, kind: "page" }]
    : pathTo(pages, pageId);
  const current = record ? undefined : trail.at(-1);
  const label = { idle: "", saving: t.saving, saved: t.saved, error: t.saveError }[saveState];
  const canEdit = level === "edit" || level === "full";
  const ScopeIcon = scope === "workspace" ? Users : Lock;

  return (
    <header className="flex h-[var(--topbar-h)] shrink-0 items-center gap-2 px-3 text-[14px]">
      <SidebarToggle />
      <nav aria-label="Ruta" className="flex min-w-0 items-center gap-1 text-ink-2">
        {trail.map((p, i) => (
          <span key={p.id} className="flex min-w-0 items-center gap-1">
            {i > 0 && <span className="text-ink-3">/</span>}
            <Link href={`/${p.id}`} className="flex min-w-0 items-center gap-1 rounded px-1.5 py-0.5 hover:bg-hover">
              <PageIcon icon={p.icon} size={16} kind={p.kind} />
              <span className="truncate">{p.title || t.untitled}</span>
            </Link>
          </span>
        ))}
      </nav>
      {!record && (
        <span className="flex shrink-0 items-center gap-1 rounded px-1.5 text-[13px] text-ink-3" data-testid="privacy-indicator" title={scope === "workspace" ? "Visible para todo el espacio de trabajo" : "Solo las personas invitadas"}>
          <ScopeIcon size={13} />
          {scope === "workspace" ? "Espacio de equipo" : "Privada"}
        </span>
      )}
      {settings?.locked ? (
        <span className="flex items-center gap-1 rounded bg-hover px-1.5 text-[12px] text-ink-2" data-testid="locked-badge">
          <Lock size={12} /> Bloqueada
        </span>
      ) : (
        !canEdit && (
          <span className="rounded bg-hover px-1.5 text-[12px] text-ink-2" data-testid="readonly-badge">
            {level === "comment" ? "Solo comentar" : "Solo lectura"}
          </span>
        )
      )}
      <div className="ml-auto flex items-center gap-1">
        {offline && (
          <span className="mr-1 rounded bg-[#fdebec] px-1.5 text-[12px] text-[#5d1715]" data-testid="offline-badge" title="Tus cambios se sincronizarán al recuperar la conexión">
            Sin conexión
          </span>
        )}
        {presence.length > 0 && (
          <div className="mr-1 flex -space-x-1.5" data-testid="presence" aria-label="Personas en esta página">
            {presence.slice(0, 5).map((u, i) => (
              <span key={`${u.id}-${i}`} title={u.name} data-testid="presence-avatar" className="flex size-6 items-center justify-center rounded-full border-2 border-[var(--bg)] text-[11px] font-medium text-white" style={{ background: u.color }}>
                {u.name.charAt(0).toUpperCase()}
              </span>
            ))}
          </div>
        )}
        <span role="status" aria-live="polite" className="mr-1 text-[12px] text-ink-3" data-testid="save-status">
          {label}
        </span>
        {!record && (
          <button
            ref={shareBtn}
            type="button"
            data-testid="share-btn"
            onClick={() => shareBtn.current && setShare(anchorOf(shareBtn.current))}
            className="flex h-7 items-center rounded-md px-2 hover:bg-hover"
          >
            {t.share}
          </button>
        )}
        {!record && onToggleComments && (
          <button
            type="button"
            aria-label="Comentarios"
            title="Comentarios"
            aria-pressed={commentsOpen}
            data-testid="comments-btn"
            onClick={onToggleComments}
            className={`flex size-7 items-center justify-center rounded hover:bg-hover ${commentsOpen ? "bg-active" : ""}`}
          >
            <MessageSquare size={16} className="text-ink-2" />
          </button>
        )}
        <button
          type="button"
          aria-label="Copiar enlace"
          title="Copiar enlace"
          data-testid="topbar-copy-link"
          onClick={async () => {
            await navigator.clipboard?.writeText(`${window.location.origin}/${pageId}`).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="flex size-7 items-center justify-center rounded hover:bg-hover"
        >
          <Link2 size={16} className={copied ? "text-accent" : "text-ink-2"} />
        </button>
        {current && (
          <button
            aria-label={current.isFavorite ? t.removeFavorite : t.addFavorite}
            aria-pressed={current.isFavorite}
            title={current.isFavorite ? t.removeFavorite : t.addFavorite}
            onClick={() => void toggleFavorite(current.id)}
            className="flex size-7 items-center justify-center rounded hover:bg-hover"
          >
            <Star size={16} className={current.isFavorite ? "fill-[#f5c542] text-[#f5c542]" : "text-ink-2"} />
          </button>
        )}
        <button
          type="button"
          aria-label={t.more}
          data-testid="page-more"
          onClick={(e) => setMore(anchorOf(e.currentTarget))}
          className="flex size-7 items-center justify-center rounded hover:bg-hover"
        >
          <MoreHorizontal size={16} className="text-ink-2" />
        </button>
      </div>
      {share && <ShareDialog pageId={pageId} anchor={share} onClose={() => setShare(null)} onChanged={() => {
          void refreshPages();
          onAccessChanged?.();
        }} />}
      {more && (
        <Popover anchor={more} onClose={() => setMore(null)} label={t.more} testId="page-more-menu" width={264} align="right">
          {settings && onSettings ? (
            <PageMenu
              pageId={pageId}
              title={title}
              settings={settings}
              canEdit={canEdit}
              canUnlock={canUnlock}
              isDatabase={isDatabase}
              collectionId={collectionId}
              onSettings={onSettings}
              onHistory={() => (setMore(null), setHistory(true))}
              onAnalytics={() => (setMore(null), setAnalytics(true))}
              onClose={() => setMore(null)}
            />
          ) : (
            <MenuRow icon={<History size={16} />} onClick={() => (setMore(null), setHistory(true))} testId="open-history">
              {t.versionHistory}
            </MenuRow>
          )}
        </Popover>
      )}
      {analytics && <AnalyticsPanel pageId={pageId} onClose={() => setAnalytics(false)} />}
      {history && <VersionHistory pageId={pageId} canRestore={canEdit} onClose={() => setHistory(false)} />}
    </header>
  );
}
