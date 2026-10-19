"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { AccessContext, type AccessLevel } from "@/components/access-context";
import { call } from "@/components/database/api";
import { DatabaseView } from "@/components/database/database-view";
import { BlockEditor, type DocJson } from "@/components/editor/block-editor";
import { PageIcon } from "@/components/page-icon";

type PublicPage = {
  level: "view" | "comment" | "edit";
  rootId: string;
  page: { id: string; title: string; icon: string | null; kind: string; content: unknown };
  databaseId: string | null;
};

const asDoc = (v: unknown): DocJson | null => (v && typeof v === "object" && (v as { type?: string }).type === "doc" ? (v as DocJson) : null);

function PublicView() {
  const { token } = useParams<{ token: string }>();
  const search = useSearchParams();
  const pageParam = search.get("page");
  const [data, setData] = useState<PublicPage | null>(null);
  const [missing, setMissing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    let alive = true;
    fetch(`/api/public/${token}${pageParam ? `?page=${pageParam}` : ""}`).then(async (r) => {
      if (!alive) return;
      if (r.ok) setData(await r.json());
      else setMissing(true);
    });
    return () => {
      alive = false;
    };
  }, [token, pageParam]);

  if (missing) {
    return (
      <main className="flex min-h-screen items-center justify-center text-ink-2" data-testid="public-missing">
        <p>Esta página no existe o ya no está publicada.</p>
      </main>
    );
  }
  if (!data) return <div className="min-h-screen" aria-busy />;

  const level: AccessLevel = data.level === "edit" ? "edit" : data.level === "comment" ? "comment" : "view";
  const onChange = (doc: DocJson) => {
    if (data.level !== "edit") return;
    setSaved("Guardando…");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await call(`/api/public/${token}/pages/${data.page.id}`, "PATCH", { content: doc });
      setSaved("Guardado");
    }, 500);
  };

  return (
    <AccessContext.Provider value={{ level, publicToken: token }}>
      <main className="min-h-screen bg-bg" data-testid="public-page">
        <header className="flex h-[var(--topbar-h)] items-center justify-between px-4 text-[13px] text-ink-3">
          <span>Publicado con Nodara{data.level === "edit" ? " · puedes editar" : ""}</span>
          <span role="status">{saved}</span>
        </header>
        <div className="mx-auto w-full max-w-[816px] px-12 pt-[60px] max-[900px]:px-6">
          {data.page.icon && <div className="mb-2 text-[72px] leading-none">{data.page.icon}</div>}
          <h1 className="mb-1 flex items-center gap-2 text-[40px] font-bold leading-[1.2]" data-testid="public-title">
            {!data.page.icon && data.page.kind === "database" && <PageIcon icon={null} size={32} kind="database" />}
            {data.page.title || "Sin título"}
          </h1>
          {data.page.kind === "database" && data.databaseId ? (
            <DatabaseView collectionId={data.databaseId} />
          ) : (
            <BlockEditor pageId={data.page.id} initial={asDoc(data.page.content)} editable={data.level === "edit"} onChange={onChange} />
          )}
        </div>
      </main>
    </AccessContext.Provider>
  );
}

export default function PublicPageRoute() {
  return (
    <Suspense>
      <PublicView />
    </Suspense>
  );
}
