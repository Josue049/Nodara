"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

/** Diálogo modal accesible: foco atrapado, se cierra con Escape o al pulsar fuera, y devuelve el foco al cerrarse. */
export function Modal({ label, testId, onClose, children, width = 560 }: { label: string; testId?: string; onClose: () => void; children: React.ReactNode; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const focusables = () => Array.from(el?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])') ?? []);
    (focusables()[1] ?? focusables()[0])?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "Tab") {
        const f = focusables();
        if (f.length === 0) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("keydown", key, true);
      previous?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="nd-fade fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4" onMouseDown={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        data-testid={testId}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ width: `min(${width}px, 100%)` }}
        className="nd-pop relative max-h-[calc(100vh-48px)] overflow-y-auto rounded-[14px] bg-[var(--popover)] p-5 text-[14px] shadow-[var(--shadow-pop)]"
      >
        <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute right-3 top-3 rounded p-1 hover:bg-hover">
          <X size={16} />
        </button>
        {children}
      </div>
    </div>
  );
}
