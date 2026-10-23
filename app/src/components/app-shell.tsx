"use client";

import { ChevronsRight, Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ShortcutsDialog } from "./shortcuts-dialog";
import { Sidebar } from "./sidebar";

type Shell = {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
  /** Con la barra cerrada en escritorio: mostrarla flotando mientras el puntero está encima (true) u ocultarla con retardo (false). */
  peekSidebar: (show: boolean) => void;
  shortcutsOpen: boolean;
  setShortcutsOpen: (v: boolean) => void;
};
const ShellContext = createContext<Shell | null>(null);
export const useShell = () => {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell fuera de AppShell");
  return ctx;
};

const KEY = "nodara:sidebar";

/**
 * Estructura de la aplicación: barra lateral fija en escritorio y cajón deslizable en pantallas estrechas (< 768 px).
 * Ctrl+\ muestra u oculta la barra; Ctrl+/ abre la lista de atajos. Cerrada en escritorio, pasar el puntero por el botón
 * de la barra superior la muestra flotando hasta que el puntero sale de ella.
 */
export function AppShell({ children, extras }: { children: React.ReactNode; extras?: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [peek, setPeek] = useState(false);
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const peekSidebar = useCallback((show: boolean) => {
    if (peekTimer.current) clearTimeout(peekTimer.current);
    peekTimer.current = null;
    if (window.matchMedia("(max-width: 767px)").matches) return;
    if (show) setPeek(true);
    else peekTimer.current = setTimeout(() => setPeek(false), 250);
  }, []);
  // Al fijar la barra (o al cerrarla con el botón) se abandona la vista flotante.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPeek(false);
  }, [sidebarOpen]);
  const floating = !sidebarOpen && peek;

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

  const value = useMemo(
    () => ({ sidebarOpen, toggleSidebar, closeSidebar, peekSidebar, shortcutsOpen, setShortcutsOpen }),
    [sidebarOpen, toggleSidebar, closeSidebar, peekSidebar, shortcutsOpen],
  );

  return (
    <ShellContext.Provider value={value}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[100] focus:rounded-md focus:bg-[var(--popover)] focus:px-3 focus:py-2 focus:shadow-[var(--shadow-pop)]">
        Saltar al contenido
      </a>
      <div className="flex h-screen w-screen overflow-hidden" data-sidebar={sidebarOpen ? "open" : floating ? "peek" : "closed"}>
        {sidebarOpen && <button type="button" aria-label="Cerrar menú lateral" onClick={closeSidebar} className="nd-fade fixed inset-0 z-40 bg-black/30 md:hidden" tabIndex={-1} />}
        <div
          data-testid="sidebar-container"
          className={`nd-sidebar-wrap h-full shrink-0 max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 ${
            sidebarOpen
              ? "max-md:shadow-[var(--shadow-pop)]"
              : floating
                ? "nd-sidebar-peek max-md:-translate-x-full md:fixed md:bottom-3 md:left-0 md:top-[52px] md:z-50 md:h-auto md:overflow-hidden md:rounded-r-[10px] md:shadow-[var(--shadow-menu)]"
                : "max-md:-translate-x-full md:hidden"
          }`}
          aria-hidden={!sidebarOpen && !floating}
          inert={!sidebarOpen && !floating}
          onMouseEnter={floating ? () => peekSidebar(true) : undefined}
          onMouseLeave={floating ? () => peekSidebar(false) : undefined}
          onClick={(e) => {
            // En móvil, elegir una página (aunque sea la actual) cierra el cajón.
            if ((e.target as HTMLElement).closest("a[href]") && window.matchMedia("(max-width: 767px)").matches) closeSidebar();
          }}
        >
          <Sidebar floating={floating} onToggle={toggleSidebar} />
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

/**
 * Botón de la barra superior que abre la barra lateral (visible cuando está cerrada o en móvil).
 * En escritorio, al pasar el puntero muestra «››» y la barra flotante; con clic la fija.
 */
export function SidebarToggle() {
  const { sidebarOpen, toggleSidebar, peekSidebar } = useShell();
  return (
    <button
      type="button"
      aria-label={sidebarOpen ? "Ocultar barra lateral" : "Mostrar barra lateral"}
      aria-expanded={sidebarOpen}
      data-testid="sidebar-toggle"
      title="Barra lateral (Ctrl+\)"
      onClick={toggleSidebar}
      onMouseEnter={() => !sidebarOpen && peekSidebar(true)}
      onMouseLeave={() => !sidebarOpen && peekSidebar(false)}
      className={`group/st mr-1 flex size-7 shrink-0 items-center justify-center rounded hover:bg-hover ${sidebarOpen ? "md:hidden" : ""}`}
    >
      <Menu size={18} className="text-ink-2 md:group-hover/st:hidden" />
      <ChevronsRight size={18} className="hidden text-ink-2 md:group-hover/st:block" />
    </button>
  );
}
