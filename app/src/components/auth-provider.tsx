"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type AuthUser = { id: string; email: string; name: string; avatarColor: string };
export type WorkspaceInfo = { id: string; name: string; icon: string | null; role: "owner" | "admin" | "member" | "guest"; memberCount: number };

type Ctx = {
  user: AuthUser;
  workspaces: WorkspaceInfo[];
  workspace: WorkspaceInfo;
  switchWorkspace: (id: string) => Promise<void>;
  createWorkspace: (name: string) => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export function useAuth(): Ctx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth fuera de AuthGate");
  return ctx;
}

/** Recarga completa (no navegación de Next): el estado de la aplicación pertenece a la sesión o al espacio anteriores. */
export function hardNavigate(to: string) {
  window.location.href = to;
}

async function post(url: string, body?: unknown) {
  const res = await fetch(url, { method: "POST", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
  return res.status === 204 ? null : res.json();
}

/** Carga la sesión; sin sesión redirige a /login. Mientras tanto no muestra la aplicación. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<{ user: AuthUser; workspaces: WorkspaceInfo[]; current: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/me");
    if (res.status === 401) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    const data = await res.json();
    setState({ user: data.user, workspaces: data.workspaces, current: data.currentWorkspaceId });
  }, [router, pathname]);

  useEffect(() => {
    let alive = true;
    fetch("/api/me")
      .then(async (res) => {
        if (!alive) return;
        if (res.status === 401) return router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        const data = await res.json();
        setState({ user: data.user, workspaces: data.workspaces, current: data.currentWorkspaceId });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // Solo al montar: la sesión se refresca de forma explícita con refresh().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: Ctx | null = (() => {
    if (!state) return null;
    const workspace = state.workspaces.find((w) => w.id === state.current) ?? state.workspaces[0];
    return {
      user: state.user,
      workspaces: state.workspaces,
      workspace,
      refresh: load,
      switchWorkspace: async (id) => {
        await post("/api/me/workspace", { workspaceId: id });
        hardNavigate("/");
      },
      createWorkspace: async (name) => {
        const ws = (await post("/api/workspaces", { name })) as WorkspaceInfo;
        await post("/api/me/workspace", { workspaceId: ws.id });
        hardNavigate("/");
      },
      logout: async () => {
        await post("/api/auth/logout");
        hardNavigate("/login");
      },
    };
  })();

  if (!value) return <div className="flex h-screen items-center justify-center text-ink-3" aria-busy data-testid="auth-loading" />;
  if (!value.workspace) return <div className="flex h-screen items-center justify-center text-ink-2">No perteneces a ningún espacio de trabajo.</div>;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
