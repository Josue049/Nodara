"use client";

import type { Editor } from "@tiptap/core";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { t } from "@/lib/strings";
import { SmilePlus } from "lucide-react";
import { NodaraProvider, type CollabUser } from "@/lib/collab/provider";
import { call, dbApi } from "./database/api";
import { DatabaseView } from "./database/database-view";
import { RecordProperties } from "./database/record-properties";
import { EmojiPicker } from "./emoji-picker";
import { BlockEditor, type DocJson } from "./editor/block-editor";
import { AccessContext, type AccessLevel } from "./access-context";
import { hardNavigate, useAuth } from "./auth-provider";
import type { MentionMember } from "./editor/mention-menu";
import { CommentsPanel } from "./comments-panel";
import { Topbar, type SaveState } from "./topbar";
import { useWorkspace } from "./workspace-provider";

type Loaded = {
  id: string;
  title: string;
  icon: string | null;
  parentId: string | null;
  kind: string;
  collectionId: string | null;
  deletedAt: string | null;
  content: unknown;
  level: AccessLevel;
  scope: string;
};
type Pending = { title?: string; content?: DocJson };

const asDoc = (v: unknown): DocJson | null =>
  v && typeof v === "object" && (v as { type?: string }).type === "doc" ? (v as DocJson) : null;

const SAVE_DELAY_MS = 500;

/** Color de cursor/presencia por color de avatar (los mismos tonos de texto de las paletas de bloques). */
const USER_HEX: Record<string, string> = { gray: "#787774", brown: "#9f6b53", orange: "#d9730d", yellow: "#cb912f", green: "#448361", blue: "#337ea9", purple: "#9065b0", pink: "#c14c8a", red: "#d44c47" };

export function PageView({ pageId }: { pageId: string }) {
  const { patchLocal, restore, refreshPages, pages, updatePage } = useWorkspace();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [iconOverride, setIconOverride] = useState<string | null | undefined>(undefined);
  const [dbId, setDbId] = useState<string | null>(null);
  const [page, setPage] = useState<Loaded | null>(null);
  const [missing, setMissing] = useState(false);
  const [title, setTitle] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Pending>({});
  const editorRef = useRef<Editor | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const { user, workspace } = useAuth();
  const [collab, setCollab] = useState<NodaraProvider | null>(null);
  const [, setTick] = useState(0);
  const [members, setMembers] = useState<MentionMember[]>([]);
  const titleFocused = useRef(false);
  const focusWhenReady = useRef(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [draft, setDraft] = useState<{ from: number; to: number; text: string } | null>(null);
  const [focusThread, setFocusThread] = useState<string | null>(null);
  const [threadsVersion, setThreadsVersion] = useState(0);

  /** Quita el resaltado de un hilo resuelto o eliminado. */
  const clearThreadMark = (threadId: string) => {
    const ed = editorRef.current;
    const type = ed?.schema.marks.comment;
    if (!ed || !type) return;
    const tr = ed.state.tr;
    ed.state.doc.descendants((node, pos) => {
      node.marks.forEach((m) => {
        if (m.type === type && m.attrs.threadId === threadId) tr.removeMark(pos, pos + node.nodeSize, m);
      });
    });
    if (tr.docChanged) ed.view.dispatch(tr);
  };

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const value = pending.current;
    if (value.title === undefined && value.content === undefined) return;
    pending.current = {};
    setSaveState("saving");
    try {
      const res = await fetch(`/api/pages/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
        keepalive: true,
      });
      setSaveState(res.ok ? "saved" : "error");
    } catch {
      setSaveState("error");
    }
  }, [pageId]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/pages/${pageId}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) return setMissing(true);
        const row: Loaded = await res.json();
        setPage(row);
        setTitle(row.title);
        if (row.kind === "database") dbApi.bundleForPage(pageId).then((b) => !cancelled && setDbId(b.collection.id)).catch(() => {});
      })
      .catch(() => !cancelled && setMissing(true));
    return () => {
      cancelled = true;
      void flush();
    };
  }, [pageId, flush]);

  // Edición colaborativa: un proveedor Yjs por página abierta (se crea al conocer el tipo de página).
  const needsEditor = !!page && page.kind !== "database";
  useEffect(() => {
    if (!needsEditor) return;
    const me: CollabUser = { id: user.id, name: user.name || user.email, color: USER_HEX[user.avatarColor] ?? "#787774" };
    const provider = new NodaraProvider(pageId, {
      user: me,
      onReset: () => hardNavigate(`/${pageId}`),
      onMeta: (m) => {
        // Cambio de título hecho por otra persona: se aplica si no se está escribiendo aquí.
        if (typeof m.title === "string" && !titleFocused.current) {
          setTitle(m.title);
          patchLocal(pageId, { title: m.title });
        }
      },
    });
    const unsubscribe = provider.subscribe(() => setTick((n) => n + 1));
    setCollab(provider);
    return () => {
      unsubscribe();
      provider.destroy();
      setCollab(null);
    };
  }, [needsEditor, pageId, user, patchLocal]);

  useEffect(() => {
    let alive = true;
    call<{ members: { userId: string; name: string; avatarColor: string }[] }>(`/api/workspaces/${workspace.id}/members`)
      .then((r) => alive && setMembers(r.members.map((m) => ({ id: m.userId, name: m.name, color: m.avatarColor }))))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [workspace.id]);

  /** Vuelve a leer nivel de acceso y alcance (tras cambiar los permisos desde «Compartir»). */
  const reloadAccess = useCallback(async () => {
    const res = await fetch(`/api/pages/${pageId}`);
    if (res.ok) {
      const row: Loaded = await res.json();
      setPage((p) => (p ? { ...p, level: row.level, scope: row.scope } : p));
    }
  }, [pageId]);

  // Autoajuste de altura del título.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [title, page]);

  const schedule = (patch: Pending) => {
    pending.current = { ...pending.current, ...patch };
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
  };
  const onTitle = (value: string) => {
    setTitle(value);
    patchLocal(pageId, { title: value });
    schedule({ title: value });
  };

  if (missing) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-ink-2">
        <p className="text-[16px] font-medium text-ink">{t.notFound}</p>
        <Link href="/" className="text-accent hover:underline">
          {t.backHome}
        </Link>
      </div>
    );
  }
  if (!page) return <div className="flex-1" aria-busy />;

  const icon = iconOverride !== undefined ? iconOverride : (pages.find((p) => p.id === pageId)?.icon ?? page.icon);
  const isDatabase = page.kind === "database";
  const isRecord = !!page.collectionId;
  const inTrash = !!page.deletedAt && !pages.some((p) => p.id === pageId) && !isRecord;
  const canEdit = (page.level === "edit" || page.level === "full") && !inTrash;
  // Estado de guardado unificado: título (REST) + contenido (cola de Yjs).
  const parts = [saveState, collab?.save ?? "idle"];
  const effectiveSave: SaveState = parts.includes("saving") ? "saving" : parts.includes("error") ? "error" : parts.includes("saved") ? "saved" : "idle";
  const presence = collab ? collab.others() : [];
  const offline = collab?.status === "offline";

  return (
    <AccessContext.Provider value={{ level: page.level }}>
      <Topbar onToggleComments={() => setCommentsOpen((o) => !o)} commentsOpen={commentsOpen} pageId={pageId} saveState={effectiveSave} presence={presence.map((p) => p.user)} offline={offline} level={page.level} scope={page.scope} onAccessChanged={reloadAccess} record={isRecord ? { id: pageId, title, icon, parentId: page.parentId } : undefined} />
      {inTrash && (
        <div role="alert" className="flex items-center gap-3 bg-[#fdebec] px-4 py-2 text-[14px] text-[#5d1715]">
          {t.inTrashBanner}
          <button
            onClick={async () => {
              await restore(pageId);
              setPage({ ...page, deletedAt: null });
              await refreshPages();
            }}
            className="rounded border border-[#5d1715]/30 px-2 py-0.5 hover:bg-white/50"
          >
            {t.restore}
          </button>
        </div>
      )}
      {commentsOpen && !isDatabase && (
        <CommentsPanel
          pageId={pageId}
          userId={user.id}
          canComment={page.level !== "view" && !inTrash}
          canManage={page.level === "full"}
          members={members}
          focusThread={focusThread}
          version={threadsVersion}
          draft={draft}
          onClose={() => {
            setCommentsOpen(false);
            setDraft(null);
          }}
          onResolved={clearThreadMark}
          onDraftCancel={() => setDraft(null)}
          onDraftSubmit={async (body, mentions) => {
            if (!draft) return;
            const { id } = await call<{ id: string }>(`/api/pages/${pageId}/comments`, "POST", { body, anchorText: draft.text, mentions });
            editorRef.current?.chain().setTextSelection({ from: draft.from, to: draft.to }).setMark("comment", { threadId: id }).run();
            setDraft(null);
            setThreadsVersion((n) => n + 1);
          }}
        />
      )}
      <div
        className="nd-scroll flex-1 overflow-y-auto"
        onClick={(e) => {
          const el = (e.target as HTMLElement).closest<HTMLElement>("[data-thread-id]");
          if (el) {
            setFocusThread(el.dataset.threadId ?? null);
            setCommentsOpen(true);
          }
        }}
      >
        <div className={`mx-auto w-full px-12 pt-[84px] max-[900px]:px-6 ${isDatabase ? "max-w-[1100px]" : "max-w-[816px]"}`}>
          <div className="group/icon relative">
            {icon ? (
              <button
                aria-label={t.changeIcon}
                data-testid="page-icon"
                onClick={() => canEdit && setPickerOpen((o) => !o)}
                className="mb-2 flex size-[78px] items-center justify-center rounded-md text-[72px] leading-none hover:bg-hover"
              >
                {icon}
              </button>
            ) : (
              canEdit && (
                <button
                  onClick={() => setPickerOpen((o) => !o)}
                  data-testid="add-icon"
                  className="mb-1 flex items-center gap-1.5 rounded-md px-2 py-1 text-[14px] text-ink-3 opacity-0 hover:bg-hover focus-visible:opacity-100 group-hover/icon:opacity-100"
                >
                  <SmilePlus size={16} /> {t.addIcon}
                </button>
              )
            )}
            {pickerOpen && (
              <EmojiPicker
                onClose={() => setPickerOpen(false)}
                onPick={(e) => {
                  setPickerOpen(false);
                  setIconOverride(e);
                  void updatePage(pageId, { icon: e });
                }}
              />
            )}
          <textarea
            ref={area}
            value={title}
            rows={1}
            readOnly={!canEdit}
            placeholder={t.titlePlaceholder}
            aria-label="Título de la página"
            data-testid="page-title"
            onFocus={() => (titleFocused.current = true)}
            onBlur={() => (titleFocused.current = false)}
            onChange={(e) => onTitle(e.target.value.replace(/\n/g, " "))}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              // El editor se monta al sincronizar con el servidor: si aún no existe, el foco queda pendiente.
              if (editorRef.current) editorRef.current.commands.focus("start");
              else focusWhenReady.current = true;
            }}
            className="w-full resize-none overflow-hidden bg-transparent text-[40px] font-bold leading-[1.2] tracking-[-0.01em] outline-none placeholder:text-ink-3"
          />
          </div>
          {isDatabase && dbId && <DatabaseView key={dbId} collectionId={dbId} />}
          {isRecord && <RecordProperties pageId={pageId} />}
          {!isDatabase && (
            <>
              {collab?.synced ? (
                <BlockEditor
                  key={collab.cid}
                  pageId={pageId}
                  initial={asDoc(page.content)}
                  editable={canEdit}
                  onChange={(doc) => schedule({ content: doc })}
                  onReady={(ed) => {
                    editorRef.current = ed;
                    if (focusWhenReady.current) {
                      focusWhenReady.current = false;
                      ed.commands.focus("start");
                    }
                  }}
                  collab={collab}
                  members={members}
                  onComment={(range) => {
                    setDraft(range);
                    setCommentsOpen(true);
                  }}
                />
              ) : (
                <div className="min-h-[120px]" aria-busy data-testid="editor-loading" />
              )}
              <div aria-hidden className="min-h-[30vh] cursor-text" onClick={() => editorRef.current?.commands.focus("end")} />
            </>
          )}
        </div>
      </div>
    </AccessContext.Provider>
  );
}
