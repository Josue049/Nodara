"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ShortcutsDialog } from "./shortcuts-dialog";
import { Sidebar } from "./sidebar";

type Shell = { sidebarOpen: boolean; toggleSidebar: () => void; closeSidebar: () => void; shortcutsOpen: boolean; setShortcutsOpen: (v: boolean) => void };
const ShellContext = createContext<Shell | null>(null);
export const useShell = () => {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell fuera de AppShell");
  return ctx;
};

const KEY = "nodara:sidebar";

/**
 * Estructura de la aplicación: barra lateral fija en escritorio y cajón deslizable en pantallas estrechas (< 768 px).
 * Ctrl+\ muestra u oculta la barra; Ctrl+/ abre la lista de atajos.
 */
export function AppShell({ children, extras }: { children: React.ReactNode; extras?: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Estado inicial: en móvil cerrada; en escritorio, la última elección de la persona.
  useEffect(() => {
    let open = true;
    try {
      open = localStorage.getItem(KEY) !== "closed";
    } catch {}
    // Se lee en el cliente tras hidratar (el servidor no conoce el ancho de pantalla): evita un desajuste de hidratación.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSidebarOpen(window.matchMedia("(max-width: 767px)").matches ? false : open);
  }, []);
  // Al navegar en móvil, el cajón se cierra.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (window.matchMedia("(max-width: 767px)").matches) setSidebarOpen(false);
  }, [pathname]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((o) => {
      try {
        if (!window.matchMedia("(max-width: 767px)").matches) localStorage.setItem(KEY, o ? "closed" : "open");
      } catch {}
      return !o;
    });
  }, []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      if (e.key === "\\") {
        e.preventDefault();
        toggleSidebar();
      } else if (e.key === "/") {
        e.preventDefault();
        setShortcutsOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSidebar]);

  const value = useMemo(() => ({ sidebarOpen, toggleSidebar, closeSidebar, shortcutsOpen, setShortcutsOpen }), [sidebarOpen, toggleSidebar, closeSidebar, shortcutsOpen]);

  return (
    <ShellContext.Provider value={value}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[100] focus:rounded-md focus:bg-[var(--popover)] focus:px-3 focus:py-2 focus:shadow-[var(--shadow-pop)]">
        Saltar al contenido
      </a>
      <div className="flex h-screen w-screen overflow-hidden" data-sidebar={sidebarOpen ? "open" : "closed"}>
        {sidebarOpen && <button type="button" aria-label="Cerrar menú lateral" onClick={closeSidebar} className="nd-fade fixed inset-0 z-40 bg-black/30 md:hidden" tabIndex={-1} />}
        <div
          data-testid="sidebar-container"
          className={`nd-sidebar-wrap h-full shrink-0 max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 ${sidebarOpen ? "max-md:shadow-[var(--shadow-pop)]" : "max-md:-translate-x-full md:hidden"}`}
          aria-hidden={!sidebarOpen}
          inert={!sidebarOpen}
          onClick={(e) => {
            // En móvil, elegir una página (aunque sea la actual) cierra el cajón.
            if ((e.target as HTMLElement).closest("a[href]") && window.matchMedia("(max-width: 767px)").matches) closeSidebar();
          }}
        >
          <Sidebar />
        </div>
        {extras}
        <main id="main" tabIndex={-1} className="flex min-w-0 flex-1 flex-col bg-bg outline-none">
          {children}
        </main>
      </div>
      {shortcutsOpen && <ShortcutsDialog onClose={() => setShortcutsOpen(false)} />}
    </ShellContext.Provider>
  );
}

/** Botón de la barra superior que abre o cierra la barra lateral (visible cuando está cerrada o en móvil). */
export function SidebarToggle() {
  const { sidebarOpen, toggleSidebar } = useShell();
  return (
    <button
      type="button"
      aria-label={sidebarOpen ? "Ocultar barra lateral" : "Mostrar barra lateral"}
      aria-expanded={sidebarOpen}
      data-testid="sidebar-toggle"
      title="Barra lateral (Ctrl+\)"
      onClick={toggleSidebar}
      className={`mr-1 flex size-7 shrink-0 items-center justify-center rounded hover:bg-hover ${sidebarOpen ? "md:hidden" : ""}`}
    >
      <Menu size={18} className="text-ink-2" />
    </button>
  );
}
