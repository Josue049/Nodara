"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { t } from "@/lib/strings";
import { Topbar, type SaveState } from "./topbar";
import { useWorkspace } from "./workspace-provider";

type Loaded = { id: string; title: string; deletedAt: string | null };

const SAVE_DELAY_MS = 500;

export function PageView({ pageId }: { pageId: string }) {
  const { patchLocal, restore, refreshPages, pages } = useWorkspace();
  const [page, setPage] = useState<Loaded | null>(null);
  const [missing, setMissing] = useState(false);
  const [title, setTitle] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const value = pending.current;
    if (value === null) return;
    pending.current = null;
    setSaveState("saving");
    try {
      const res = await fetch(`/api/pages/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: value }),
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
      })
      .catch(() => !cancelled && setMissing(true));
    return () => {
      cancelled = true;
      void flush();
    };
  }, [pageId, flush]);

  // Autoajuste de altura del título.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [title, page]);

  const onTitle = (value: string) => {
    setTitle(value);
    patchLocal(pageId, { title: value });
    pending.current = value;
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
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

  const inTrash = !!page.deletedAt && !pages.some((p) => p.id === pageId);

  return (
    <>
      <Topbar pageId={pageId} saveState={saveState} />
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
      <div className="nd-scroll flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[900px] px-24 pt-[84px] max-[900px]:px-6">
          <textarea
            ref={area}
            value={title}
            rows={1}
            readOnly={inTrash}
            placeholder={t.titlePlaceholder}
            aria-label="Título de la página"
            data-testid="page-title"
            onChange={(e) => onTitle(e.target.value.replace(/\n/g, " "))}
            onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            className="w-full resize-none overflow-hidden bg-transparent text-[40px] font-bold leading-[1.2] tracking-[-0.01em] outline-none placeholder:text-ink-3"
          />
        </div>
      </div>
    </>
  );
}
