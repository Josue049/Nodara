"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { TreePage } from "@/lib/tree";

type Patch = Partial<Pick<TreePage, "title" | "icon" | "isFavorite" | "parentId" | "position">>;

type Ctx = {
  pages: TreePage[];
  trash: TreePage[];
  loaded: boolean;
  createPage: (parentId?: string | null) => Promise<string>;
  patchLocal: (id: string, patch: Patch) => void;
  toggleFavorite: (id: string) => Promise<void>;
  moveToTrash: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
  deleteForever: (id: string) => Promise<void>;
  refreshTrash: () => Promise<void>;
  refreshPages: () => Promise<void>;
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
  const [pages, setPages] = useState<TreePage[]>([]);
  const [trash, setTrash] = useState<TreePage[]>([]);
  const [loaded, setLoaded] = useState(false);

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

  const createPage = useCallback(
    async (parentId: string | null = null) => {
      const row = await api<TreePage>("/api/pages", {
        method: "POST",
        body: JSON.stringify({ parentId }),
      });
      setPages((p) => [...p, row]);
      return row.id;
    },
    [],
  );

  const patchLocal = useCallback((id: string, patch: Patch) => {
    setPages((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }, []);

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

  const value = useMemo(
    () => ({
      pages, trash, loaded, createPage, patchLocal, toggleFavorite,
      moveToTrash, restore, deleteForever, refreshTrash, refreshPages,
    }),
    [pages, trash, loaded, createPage, patchLocal, toggleFavorite, moveToTrash, restore, deleteForever, refreshTrash, refreshPages],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
