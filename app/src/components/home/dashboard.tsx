"use client";

import { ArrowRight, Check, Clock, FilePlus2, FileText, PenLine, Plus, Search, Star, Table2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { greeting, gradientFor, homeCounts, pick, recentPages, relativeTime, type RecentPage } from "@/lib/home";
import { t } from "@/lib/strings";
import { SidebarToggle } from "../app-shell";
import { useAuth, type WorkspaceInfo } from "../auth-provider";
import { coverStyle } from "../page-cover";
import { PageIcon } from "../page-icon";
import { useWorkspace } from "../workspace-provider";
import { MountainBanner } from "./mountain-banner";

const ROLE_LABELS = { owner: "Propietario", admin: "Administrador", member: "Miembro", guest: "Invitado" } as const;
const dateFmt = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" });
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const card =
  "rounded-xl border border-[var(--home-border)] bg-[var(--home-card)] shadow-[var(--home-shadow-sm)] transition duration-200 ease-out";
const cardHover = "hover:-translate-y-0.5 hover:border-[var(--home-border-strong)] hover:shadow-[var(--home-shadow)]";
const sectionTitle = "text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-3";

/** Panel de inicio: saludo con panorámica, acciones de creación, resumen del espacio, recientes y espacios de trabajo. */
export function HomeDashboard() {
  const { pages, loaded, createPage, createDatabase, refreshPages, setSearchOpen, setSettings } = useWorkspace();
  const { user, workspace, workspaces } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  // Hora del cliente (no se renderiza en el servidor: el árbol vive tras AuthGate).
  const [now, setNow] = useState(() => Date.now());

  // Al volver al inicio, refresca fechas de edición y visitas (la lista en memoria no las actualiza al editar).
  useEffect(() => {
    void refreshPages().catch(() => {});
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [refreshPages]);

  const counts = useMemo(() => homeCounts(pages, user.id, now), [pages, user.id, now]);
  const recent = useMemo(() => recentPages(pages, 8), [pages]);
  const canCreate = workspace.role !== "guest";
  const firstName = (user.name || user.email).split(/[\s@]/)[0];

  const run = async (make: () => Promise<string>) => {
    if (busy) return;
    setBusy(true);
    try {
      router.push(`/${await make()}`);
    } finally {
      setBusy(false);
    }
  };
  const newPage = () => run(() => createPage(null));
  const newDatabase = () => run(() => createDatabase(null));

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--home-bg)]" data-testid="home-dashboard">
      <div className="flex h-[var(--topbar-h)] shrink-0 items-center gap-1 px-3">
        <SidebarToggle />
        <span className="text-[14px] font-medium text-ink-2">{t.home}</span>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="ml-auto flex h-8 items-center gap-2 rounded-lg border border-[var(--home-border)] bg-[var(--home-card)] px-2.5 text-[13px] text-ink-2 transition hover:border-[var(--home-border-strong)] hover:text-ink"
          data-testid="home-search"
        >
          <Search size={14} aria-hidden />
          <span className="max-sm:hidden">{t.search}</span>
          <kbd className="rounded bg-[var(--home-chip)] px-1.5 font-sans text-[11px] text-ink-2 max-sm:hidden">Ctrl K</kbd>
        </button>
      </div>

      <div className="nd-scroll flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1120px] px-4 pb-16 pt-2 sm:px-6 lg:px-10">
          {/* Panorámica con saludo y acciones */}
          <section className="nd-pop relative isolate h-[236px] overflow-hidden rounded-2xl text-[var(--banner-ink)] shadow-[var(--home-shadow)] sm:h-[264px]" data-testid="home-hero">
            <MountainBanner className="absolute inset-0 -z-10 size-full" />
            <div className="absolute inset-0 -z-10" style={{ background: "var(--banner-scrim)" }} />
            <div className="flex h-full flex-col justify-end gap-4 p-5 sm:p-8 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[var(--banner-eyebrow)]">{capitalize(dateFmt.format(now))}</p>
                <h1 className="mt-1 truncate text-[26px] font-bold leading-tight tracking-[-0.02em] sm:text-[34px]" data-testid="home-greeting">
                  {greeting(new Date(now).getHours())}, {firstName}
                </h1>
                <p className="mt-1 truncate text-[14px] text-[var(--banner-ink-2)]">
                  {workspace.name} · {plural(counts.pages, "página", "páginas")} · {plural(workspace.memberCount, "miembro", "miembros")}
                </p>
              </div>
              {canCreate && (
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={newPage} disabled={busy} className="nd-btn-brand" data-testid="home-create-page">
                    <Plus size={16} aria-hidden /> {t.homeCreatePage}
                  </button>
                  <button type="button" onClick={newDatabase} disabled={busy} className="nd-btn-glass" data-testid="home-create-database">
                    <Table2 size={16} aria-hidden /> {t.newDatabase}
                  </button>
                </div>
              )}
            </div>
          </section>
          {!canCreate && <p className="mt-3 text-[13px] text-ink-3">{t.homeGuestNote}</p>}

          {/* Contadores */}
          <section className="mt-6" aria-labelledby="home-summary">
            <h2 id="home-summary" className="sr-only">
              {t.homeSummary}
            </h2>
            <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat icon={<FileText size={18} />} value={counts.pages} label={t.homeStatPages} testId="stat-pages" />
              <Stat icon={<Table2 size={18} />} value={counts.databases} label={t.homeStatDatabases} testId="stat-databases" />
              <Stat icon={<PenLine size={18} />} value={counts.editedThisWeek} label={t.homeStatEdited} testId="stat-edited" />
              <Stat icon={<Users size={18} />} value={workspace.memberCount} label={t.homeStatMembers} testId="stat-members" onClick={() => setSettings("members")} />
            </ul>
          </section>

          {/* Recientes */}
          <section className="mt-9" aria-labelledby="home-recent">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="home-recent" className={sectionTitle}>
                {t.homeRecent}
              </h2>
              {recent.length > 0 && (
                <button type="button" onClick={() => setSearchOpen(true)} className="group/all flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[13px] font-medium text-[var(--brand-link)] hover:bg-[var(--home-chip)]">
                  {t.homeSeeAll}
                  <ArrowRight size={14} className="transition-transform group-hover/all:translate-x-0.5" aria-hidden />
                </button>
              )}
            </div>
            {loaded && pages.length === 0 ? (
              <div className={`${card} flex flex-col items-start gap-1 px-6 py-8 sm:flex-row sm:items-center sm:gap-5`} data-testid="home-empty">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[var(--home-chip)] text-[var(--brand-link)]">
                  <FilePlus2 size={22} aria-hidden />
                </span>
                <div className="flex-1">
                  <p className="text-[16px] font-semibold text-ink">{t.noPagesTitle}</p>
                  <p className="text-ink-2">{t.noPagesBody}</p>
                </div>
                {canCreate && (
                  <button type="button" onClick={newPage} disabled={busy} className="nd-btn-brand mt-3 sm:mt-0">
                    <Plus size={16} aria-hidden /> {t.homeCreatePage}
                  </button>
                )}
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="home-recent-list">
                {recent.map((p) => (
                  <RecentCard key={p.id} page={p} now={now} />
                ))}
              </ul>
            )}
          </section>

          {/* Espacios de trabajo */}
          <section className="mt-9" aria-labelledby="home-spaces">
            <h2 id="home-spaces" className={`${sectionTitle} mb-3`}>
              {t.homeSpaces}
            </h2>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="home-spaces">
              {workspaces.map((w) => (
                <SpaceCard key={w.id} space={w} current={w.id === workspace.id} counts={w.id === workspace.id ? counts : null} />
              ))}
              <NewSpaceCard />
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, value, label, testId, onClick }: { icon: React.ReactNode; value: number; label: string; testId: string; onClick?: () => void }) {
  const body = (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--home-chip)] text-[var(--brand-link)]" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 text-left">
        <span className="block text-[22px] font-bold leading-none tracking-[-0.02em] text-ink tabular-nums" data-testid={`${testId}-value`}>
          {value}
        </span>
        <span className="mt-1 block truncate text-[12px] text-ink-3">{label}</span>
      </span>
    </>
  );
  return (
    <li data-testid={testId}>
      {onClick ? (
        <button type="button" onClick={onClick} className={`${card} ${cardHover} flex w-full items-center gap-3 p-3.5`}>
          {body}
        </button>
      ) : (
        <div className={`${card} flex items-center gap-3 p-3.5`}>{body}</div>
      )}
    </li>
  );
}

function RecentCard({ page, now }: { page: RecentPage; now: number }) {
  const cover = coverStyle(page.cover ?? null) ?? { background: gradientFor(page.id) };
  return (
    <li>
      <Link href={`/${page.id}`} className={`${card} ${cardHover} group/card flex h-full flex-col overflow-hidden`} data-testid="home-recent-card">
        <span className="relative block h-[68px] shrink-0" style={cover} aria-hidden>
          <span className="absolute inset-0 bg-black/0 transition-colors group-hover/card:bg-black/10" />
        </span>
        <span className="relative flex flex-1 flex-col px-3.5 pb-3.5 pt-7">
          <span className="absolute -top-5 left-3.5 flex size-10 items-center justify-center rounded-xl bg-[var(--home-card)] shadow-[var(--home-shadow-sm)] ring-1 ring-[var(--home-border)]">
            <PageIcon icon={page.icon} kind={page.kind} size={22} />
          </span>
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold text-ink">{page.title || t.untitled}</span>
            {page.isFavorite && <Star size={13} className="shrink-0 fill-current text-[var(--brand-link)]" aria-label={t.homeFavorites} />}
          </span>
          <span className="truncate text-[12px] text-ink-3">{page.path.length ? page.path.join(" / ") : page.kind === "database" ? t.database : " "}</span>
          <span className="mt-auto flex items-center gap-1 pt-3 text-[12px] text-ink-3">
            <Clock size={12} aria-hidden />
            {page.activity === "viewed" ? t.homeViewed : t.homeEdited} {relativeTime(page.at, now)}
          </span>
        </span>
      </Link>
    </li>
  );
}

const SPACE_GRADIENTS = ["linear-gradient(135deg,#6a48e0,#3d5fd9)", "linear-gradient(135deg,#3d5fd9,#2a9bd8)", "linear-gradient(135deg,#8b5cf6,#c06ad9)", "linear-gradient(135deg,#2f3a7a,#6a48e0)"];

function SpaceCard({ space, current, counts }: { space: WorkspaceInfo; current: boolean; counts: ReturnType<typeof homeCounts> | null }) {
  const { switchWorkspace } = useAuth();
  const [switching, setSwitching] = useState(false);
  const bg = SPACE_GRADIENTS[pick(space.id, SPACE_GRADIENTS.length)];
  const body = (
    <>
      <span className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl text-[18px] font-bold text-white shadow-[var(--home-shadow-sm)]" style={{ background: bg }} aria-hidden>
          {space.icon || (space.name || "N").charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold text-ink">{space.name}</span>
            {current && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--home-chip)] px-2 py-0.5 text-[11px] font-semibold text-[var(--brand-link)]">
                <Check size={11} aria-hidden /> {t.homeCurrentSpace}
              </span>
            )}
          </span>
          <span className="block truncate text-[12px] text-ink-3">
            {ROLE_LABELS[space.role]} · {plural(space.memberCount, "miembro", "miembros")}
          </span>
        </span>
      </span>
      {counts ? (
        <span className="mt-4 grid grid-cols-3 gap-2 text-left">
          <SpaceCount value={counts.team} label={t.teamspace} />
          <SpaceCount value={counts.private} label={t.pages} />
          <SpaceCount value={counts.shared} label={t.sharedWithMe} />
        </span>
      ) : (
        <span className="mt-4 flex items-center gap-1 text-[13px] font-medium text-[var(--brand-link)]">
          {switching ? "…" : t.homeSwitchTo} <ArrowRight size={14} aria-hidden className="transition-transform group-hover/space:translate-x-0.5" />
        </span>
      )}
    </>
  );
  return (
    <li data-testid="home-space">
      {current ? (
        <div className={`${card} flex h-full flex-col p-4 ring-1 ring-[var(--home-border-strong)]`}>{body}</div>
      ) : (
        <button
          type="button"
          disabled={switching}
          aria-label={`${t.homeSwitchTo} ${space.name}`}
          onClick={() => {
            setSwitching(true);
            void switchWorkspace(space.id).catch(() => setSwitching(false));
          }}
          className={`${card} ${cardHover} group/space flex h-full w-full flex-col p-4`}
        >
          {body}
        </button>
      )}
    </li>
  );
}

function SpaceCount({ value, label }: { value: number; label: string }) {
  return (
    <span className="rounded-lg bg-[var(--home-chip)] px-2 py-1.5">
      <span className="block text-[16px] font-bold leading-tight text-ink tabular-nums">{value}</span>
      <span className="block truncate text-[11px] text-ink-3">{label}</span>
    </span>
  );
}

function NewSpaceCard() {
  const { createWorkspace } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <li>
      {editing ? (
        <form
          className={`${card} flex h-full flex-col gap-2 p-4`}
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            void createWorkspace(name.trim()).catch((err: Error) => setError(err.message));
          }}
        >
          <label htmlFor="home-new-space" className="text-[13px] font-medium text-ink-2">
            {t.homeSpaceName}
          </label>
          <input
            id="home-new-space"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
            className="h-9 rounded-lg border border-[var(--home-border)] bg-transparent px-2.5 text-ink outline-none focus:border-[var(--brand-link)]"
          />
          {error && <p className="text-[12px] text-danger">{error}</p>}
          <div className="mt-auto flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} className="h-8 rounded-lg px-3 text-[13px] text-ink-2 hover:bg-hover">
              {t.close}
            </button>
            <button type="submit" className="nd-btn-brand h-8 px-3 text-[13px]">
              {t.create}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex h-full min-h-[120px] w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--home-border-strong)] p-4 text-center transition hover:bg-[var(--home-chip)]"
          data-testid="home-new-space"
        >
          <Plus size={20} className="text-[var(--brand-link)]" aria-hidden />
          <span className="text-[14px] font-semibold text-[var(--brand-link)]">{t.homeNewSpace}</span>
          <span className="text-[12px] text-ink-3">{t.homeNewSpaceHint}</span>
        </button>
      )}
    </li>
  );
}
