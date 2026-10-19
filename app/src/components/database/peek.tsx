"use client";

import { Maximize2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, forwardRef, useContext, useEffect, type ComponentProps } from "react";
import { PageView } from "../page-view";

type PeekCtx = { openIn: "side" | "center" | "full"; open: (id: string) => void };
const PeekContext = createContext<PeekCtx>({ openIn: "full", open: () => {} });
export const PeekProvider = PeekContext.Provider;
export const usePeek = () => useContext(PeekContext);

const RECORD_HREF = /^\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Enlace a un registro: con «Abrir en ventana lateral» activo abre el panel en vez de navegar (Ctrl/clic central siguen abriendo la página). */
export const RecordLink = forwardRef<HTMLAnchorElement, ComponentProps<typeof Link>>(function RecordLink({ onClick, href, ...rest }, ref) {
  const { openIn, open } = usePeek();
  return (
    <Link
      ref={ref}
      href={href}
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || openIn === "full" || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || typeof href !== "string" || !RECORD_HREF.test(href)) return;
        e.preventDefault();
        open(href.slice(1));
      }}
    />
  );
});

/** Panel lateral con el registro abierto: propiedades y contenido editables sin salir de la base de datos. */
export function RecordPeek({ id, onClose }: { id: string; onClose: () => void }) {
  const router = useRouter();
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector('[role="dialog"]:not([data-testid="record-peek"])')) onClose();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <aside role="dialog" aria-label="Registro" data-testid="record-peek" className="nd-slide fixed bottom-0 right-0 top-0 z-[55] flex w-[min(760px,92vw)] flex-col border-l border-line bg-bg shadow-[var(--shadow-pop)]">
      <div className="flex h-[var(--topbar-h)] shrink-0 items-center gap-1 px-3">
        <button type="button" aria-label="Cerrar" data-testid="peek-close" onClick={onClose} className="flex size-7 items-center justify-center rounded hover:bg-hover">
          <X size={16} className="text-ink-2" />
        </button>
        <button type="button" data-testid="peek-expand" onClick={() => router.push(`/${id}`)} className="flex h-7 items-center gap-1.5 rounded px-2 text-[14px] text-ink-2 hover:bg-hover">
          <Maximize2 size={14} /> Abrir como página
        </button>
      </div>
      <PageView key={id} pageId={id} peek />
    </aside>
  );
}
