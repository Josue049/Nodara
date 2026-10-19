"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type Anchor = { left: number; top: number; bottom: number; right: number };

export const anchorOf = (el: Element): Anchor => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, bottom: r.bottom, right: r.right };
};

// Pila de popovers abiertos: un clic dentro de un popover hijo (abierto después) no debe cerrar al padre.
const stack: HTMLElement[] = [];

/** Panel flotante anclado a un rectángulo. Se cierra con Escape o al hacer clic fuera. */
export function Popover({
  anchor,
  onClose,
  children,
  width = 260,
  align = "left",
  label,
  testId,
}: {
  anchor: Anchor;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  align?: "left" | "right";
  label: string;
  testId?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: anchor.left, top: anchor.bottom + 4 });

  useLayoutEffect(() => {
    const el = ref.current;
    const h = el?.offsetHeight ?? 0;
    const w = el?.offsetWidth ?? width;
    let left = align === "right" ? anchor.right - w : anchor.left;
    let top = anchor.bottom + 4;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    if (top + h > window.innerHeight - 8) top = Math.max(8, anchor.top - h - 4);
    setPos({ left, top });
  }, [anchor, align, width, children]);

  useEffect(() => {
    const el = ref.current;
    if (el) stack.push(el);
    const down = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!el || el.contains(target)) return;
      const inChild = stack.slice(stack.indexOf(el) + 1).some((n) => n.contains(target));
      if (!inChild) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("mousedown", down, true);
    document.addEventListener("keydown", key, true);
    return () => {
      const i = el ? stack.indexOf(el) : -1;
      if (i >= 0) stack.splice(i, 1);
      document.removeEventListener("mousedown", down, true);
      document.removeEventListener("keydown", key, true);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      data-testid={testId}
      style={{ position: "fixed", left: pos.left, top: pos.top, width, zIndex: 70 }}
      className="max-h-[70vh] overflow-y-auto rounded-[10px] bg-[var(--popover)] p-1 text-[14px] text-ink shadow-[var(--shadow-pop)]"
    >
      {children}
    </div>,
    document.body,
  );
}

/** Fila de menú reutilizable dentro de popovers. */
export function MenuRow({
  icon,
  children,
  onClick,
  active,
  danger,
  right,
  testId,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  active?: boolean;
  danger?: boolean;
  right?: React.ReactNode;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={`flex h-[30px] w-full items-center gap-2 rounded-md px-2 text-left hover:bg-hover ${active ? "bg-hover" : ""} ${danger ? "text-danger" : ""}`}
    >
      {icon && <span className="flex w-5 shrink-0 justify-center text-ink-2">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {right && <span className="shrink-0 text-ink-3">{right}</span>}
    </button>
  );
}
