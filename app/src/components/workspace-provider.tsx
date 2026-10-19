"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { TreePage } from "@/lib/tree";

type Patch = Partial<Pick<TreePage, "title" | "icon" | "isFavorite" | "parentId" | "position">>;

type Ctx = {
  pages: TreePage[];
  trash: TreePage[];
  loaded: boolean;
  createPage: (parentId?: string | null) => Promise<string>;
  createDatabase: (parentId?: string | null) => Promise<string>;
  patchLocal: (id: string, patch: Patch) => void;
  /** Cambia título/icono en memoria y en el servidor. */
  updatePage: (id: string, patch: Pick<Patch, "title" | "icon">) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  moveToTrash: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
  deleteForever: (id: string) => Promise<void>;
  movePage: (id: string, parentId: string | null, index: number) => Promise<void>;
  duplicatePage: (id: string) => Promise<string>;
  refreshTrash: () => Promise<void>;
  refreshPages: () => Promise<void>;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  /** Página para la que está abierto el diálogo «Mover a». */
  moveTarget: string | null;
  setMoveTarget: (id: string | null) => void;
  /** Página cuyo nombre se edita en la barra lateral. */
  renaming: string | null;
  setRenaming: (id: string | null) => void;
};

const WorkspaceContext = createContext<Ctx | null>(null);

export function useWorkspace(): Ctx {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace fuera de WorkspaceProvider");
  return ctx;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
  return res.status === 204 ? (undefined as T) : res.json();
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pages, setPages] = useState<TreePage[]>([]);
  const [trash, setTrash] = useState<TreePage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);

  // Marcador de «app hidratada y con datos»: lo usan las pruebas E2E para no actuar antes de tiempo.
  useEffect(() => {
    if (loaded) document.documentElement.dataset.nodaraReady = "1";
  }, [loaded]);

  const refreshPages = useCallback(async () => {
    setPages(await api<TreePage[]>("/api/pages"));
    setLoaded(true);
  }, []);
  const refreshTrash = useCallback(async () => {
    setTrash(await api<TreePage[]>("/api/trash"));
  }, []);

  useEffect(() => {
    let alive = true;
    api<TreePage[]>("/api/pages")
      .then((rows) => alive && setPages(rows))
      .catch(() => {})
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  const createPage = useCallback(async (parentId: string | null = null) => {
    const row = await api<TreePage>("/api/pages", { method: "POST", body: JSON.stringify({ parentId }) });
    setPages((p) => [...p, row]);
    return row.id;
  }, []);

  const createDatabase = useCallback(
    async (parentId: string | null = null) => {
      const res = await api<{ page: TreePage }>("/api/databases", { method: "POST", body: JSON.stringify({ parentId }) });
      setPages((p) => [...p, res.page]);
      return res.page.id;
    },
    [],
  );

  const patchLocal = useCallback((id: string, patch: Patch) => {
    setPages((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }, []);

  const updatePage = useCallback(
    async (id: string, patch: Pick<Patch, "title" | "icon">) => {
      patchLocal(id, patch);
      try {
        await api(`/api/pages/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      } catch (e) {
        await refreshPages();
        throw e;
      }
    },
    [patchLocal, refreshPages],
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      const cur = pages.find((p) => p.id === id);
      if (!cur) return;
      const next = !cur.isFavorite;
      patchLocal(id, { isFavorite: next });
      try {
        await api(`/api/pages/${id}`, { method: "PATCH", body: JSON.stringify({ isFavorite: next }) });
      } catch {
        patchLocal(id, { isFavorite: cur.isFavorite });
      }
    },
    [pages, patchLocal],
  );

  const moveToTrash = useCallback(
    async (id: string) => {
      await api(`/api/pages/${id}`, { method: "DELETE" });
      await Promise.all([refreshPages(), refreshTrash()]);
    },
    [refreshPages, refreshTrash],
  );

  const restore = useCallback(
    async (id: string) => {
      await api(`/api/pages/${id}/restore`, { method: "POST" });
      await Promise.all([refreshPages(), refreshTrash()]);
    },
    [refreshPages, refreshTrash],
  );

  const deleteForever = useCallback(
    async (id: string) => {
      await api(`/api/pages/${id}?permanent=1`, { method: "DELETE" });
      await refreshTrash();
    },
    [refreshTrash],
  );

  const movePage = useCallback(
    async (id: string, parentId: string | null, index: number) => {
      try {
        await api(`/api/pages/${id}/move`, { method: "POST", body: JSON.stringify({ parentId, index }) });
      } finally {
        await refreshPages();
      }
    },
    [refreshPages],
  );

  const duplicatePage = useCallback(
    async (id: string) => {
      const row = await api<TreePage>(`/api/pages/${id}/duplicate`, { method: "POST" });
      await refreshPages();
      router.push(`/${row.id}`);
      return row.id;
    },
    [refreshPages, router],
  );

  const value = useMemo(
    () => ({
      pages, trash, loaded, createPage, createDatabase, patchLocal, updatePage, toggleFavorite, moveToTrash, restore,
      deleteForever, movePage, duplicatePage, refreshTrash, refreshPages,
      searchOpen, setSearchOpen, moveTarget, setMoveTarget, renaming, setRenaming,
    }),
    [pages, trash, loaded, createPage, createDatabase, patchLocal, updatePage, toggleFavorite, moveToTrash, restore,
      deleteForever, movePage, duplicatePage, refreshTrash, refreshPages, searchOpen, moveTarget, renaming],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
