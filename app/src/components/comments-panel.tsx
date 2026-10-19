"use client";

import { Check, MessageSquare, RotateCcw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { call } from "./database/api";
import type { MentionMember } from "./editor/mention-menu";
import { Avatar } from "./settings-dialog";

type CommentView = { id: string; authorId: string | null; authorName: string; authorColor: string; body: string; createdAt: string };
export type Thread = { id: string; anchorText: string; resolved: boolean; createdAt: string; comments: CommentView[] };

const fmt = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" });

/** Ids de las personas mencionadas con @Nombre en el texto (coincidencia por nombre completo, la más larga primero). */
export function mentionedIds(body: string, members: MentionMember[]): string[] {
  const text = body.toLowerCase();
  const found = new Set<string>();
  for (const m of [...members].sort((a, b) => b.name.length - a.name.length)) {
    if (m.name && text.includes(`@${m.name.toLowerCase()}`)) found.add(m.id);
  }
  return [...found];
}

function Body({ text, members }: { text: string; members: MentionMember[] }) {
  const names = [...members].map((m) => m.name).filter(Boolean).sort((a, b) => b.length - a.length);
  if (names.length === 0) return <>{text}</>;
  const re = new RegExp(`(@(?:${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}))`, "gi");
  return (
    <>
      {text.split(re).map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="nd-mention">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

function Composer({ placeholder, onSubmit, label }: { placeholder: string; onSubmit: (body: string) => Promise<void>; label: string }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!value.trim() || busy) return;
        setBusy(true);
        try {
          await onSubmit(value.trim());
          setValue("");
        } finally {
          setBusy(false);
        }
      }}
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) e.currentTarget.form?.requestSubmit();
        }}
        rows={2}
        placeholder={placeholder}
        aria-label={label}
        className="w-full resize-none rounded-md border border-line bg-transparent p-2 text-[14px] outline-none focus:border-accent"
      />
      <button type="submit" disabled={!value.trim() || busy} className="h-7 self-end rounded-md bg-accent px-3 text-[13px] font-medium text-white disabled:opacity-50">
        Comentar
      </button>
    </form>
  );
}

/** Panel lateral de comentarios: hilos anclados a texto y comentarios de página, con respuestas, menciones (@Nombre) y resolución. */
export function CommentsPanel({
  pageId,
  userId,
  canComment,
  canManage,
  members,
  focusThread,
  onClose,
  onResolved,
  version,
  draft,
  onDraftSubmit,
  onDraftCancel,
}: {
  pageId: string;
  userId: string;
  canComment: boolean;
  canManage: boolean;
  members: MentionMember[];
  focusThread?: string | null;
  onClose: () => void;
  /** Se llama al resolver/borrar un hilo para que el editor quite su resaltado. */
  onResolved?: (threadId: string) => void;
  /** Cambia cuando se crea un hilo desde el editor para recargar la lista. */
  version?: number;
  /** Texto seleccionado al que se va a anclar un hilo nuevo. */
  draft?: { text: string } | null;
  onDraftSubmit?: (body: string, mentions: string[]) => Promise<void>;
  onDraftCancel?: () => void;
}) {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => setThreads(await call<Thread[]>(`/api/pages/${pageId}/comments`)), [pageId]);
  useEffect(() => {
    let alive = true;
    const tick = () => call<Thread[]>(`/api/pages/${pageId}/comments`).then((t) => alive && setThreads(t)).catch((e) => alive && setError(String(e.message ?? e)));
    void tick();
    const id = setInterval(tick, 5000); // las respuestas de otras personas aparecen sin recargar
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [pageId, version]);

  const visible = useMemo(() => (threads ?? []).filter((t) => t.resolved === showResolved), [threads, showResolved]);
  const act = async (fn: () => Promise<unknown>) => {
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  };

  return (
    <aside role="dialog" aria-label="Comentarios" data-testid="comments-panel" className="fixed bottom-0 right-0 top-[var(--topbar-h)] z-50 flex w-[360px] flex-col border-l border-line bg-[var(--popover)] shadow-[var(--shadow-pop)]">
      <header className="flex items-center gap-2 border-b border-line px-3 py-2">
        <MessageSquare size={16} />
        <h2 className="flex-1 font-medium">Comentarios</h2>
        <button type="button" aria-label="Cerrar" onClick={onClose} className="rounded p-1 hover:bg-hover">
          <X size={16} />
        </button>
      </header>
      <div className="flex gap-3 border-b border-line px-3 text-[13px]">
        {[
          [false, "Abiertos"],
          [true, "Resueltos"],
        ].map(([v, label]) => (
          <button key={String(v)} type="button" data-testid={v ? "tab-resolved" : "tab-open"} onClick={() => setShowResolved(v as boolean)} className={`-mb-px border-b-2 py-2 ${showResolved === v ? "border-ink font-medium" : "border-transparent text-ink-3"}`}>
            {label as string}
          </button>
        ))}
      </div>
      <div className="nd-scroll flex flex-1 flex-col gap-3 overflow-y-auto p-3">
        {error && <p role="alert" className="text-danger">{error}</p>}
        {draft && (
          <article data-testid="draft-thread" className="rounded-lg border border-accent p-2.5">
            <blockquote className="mb-2 border-l-2 border-[#e8c200] pl-2 text-[13px] text-ink-2">{draft.text}</blockquote>
            <Composer label="Comentario sobre la selección" placeholder="Añadir un comentario…" onSubmit={(body) => act(() => onDraftSubmit!(body, mentionedIds(body, members)))} />
            <button type="button" onClick={onDraftCancel} className="mt-1 text-[13px] text-ink-2 hover:text-ink">
              Cancelar
            </button>
          </article>
        )}
        {threads && visible.length === 0 && !draft && <p className="text-ink-3" data-testid="no-threads">{showResolved ? "No hay comentarios resueltos." : "Aún no hay comentarios abiertos."}</p>}
        {visible.map((t) => (
          <article key={t.id} data-testid="thread" data-thread-id={t.id} className={`rounded-lg border p-2.5 ${focusThread === t.id ? "border-accent" : "border-line"}`}>
            {t.anchorText && <blockquote className="mb-2 border-l-2 border-[#e8c200] pl-2 text-[13px] text-ink-2">{t.anchorText}</blockquote>}
            <ul className="flex flex-col gap-2.5">
              {t.comments.map((c) => (
                <li key={c.id} className="group/c flex gap-2" data-testid="comment">
                  <Avatar name={c.authorName} color={c.authorColor} size={24} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px]">
                      <span className="font-medium">{c.authorName}</span> <span className="text-ink-3">{fmt.format(new Date(c.createdAt))}</span>
                    </p>
                    <p className="whitespace-pre-wrap break-words text-[14px]">
                      <Body text={c.body} members={members} />
                    </p>
                  </div>
                  {(c.authorId === userId || canManage) && (
                    <button
                      type="button"
                      aria-label="Eliminar comentario"
                      onClick={() =>
                        act(async () => {
                          const r = await call<{ threadDeleted: boolean; threadId: string }>(`/api/comments/${c.id}`, "DELETE");
                          if (r.threadDeleted) onResolved?.(r.threadId);
                        })
                      }
                      className="h-fit rounded p-1 text-ink-3 opacity-0 hover:bg-hover group-hover/c:opacity-100 focus-visible:opacity-100"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {canComment && !t.resolved && (
              <div className="mt-2">
                <Composer label="Responder" placeholder="Responder… (usa @nombre para mencionar)" onSubmit={(body) => act(() => call(`/api/comments/${t.id}`, "POST", { body, mentions: mentionedIds(body, members) }))} />
              </div>
            )}
            {canComment && (
              <button
                type="button"
                data-testid={t.resolved ? "reopen-thread" : "resolve-thread"}
                onClick={() =>
                  act(async () => {
                    await call(`/api/comments/${t.id}`, "PATCH", { resolved: !t.resolved });
                    if (!t.resolved) onResolved?.(t.id);
                  })
                }
                className="mt-1.5 flex items-center gap-1 text-[13px] text-ink-2 hover:text-ink"
              >
                {t.resolved ? <RotateCcw size={13} /> : <Check size={13} />} {t.resolved ? "Reabrir" : "Resolver"}
              </button>
            )}
          </article>
        ))}
      </div>
      {canComment && !showResolved && (
        <div className="border-t border-line p-3">
          <Composer label="Nuevo comentario" placeholder="Añadir un comentario a la página…" onSubmit={(body) => act(() => call(`/api/pages/${pageId}/comments`, "POST", { body, mentions: mentionedIds(body, members) }))} />
        </div>
      )}
    </aside>
  );
}
