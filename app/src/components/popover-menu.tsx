"use client";

import { useEffect, useRef } from "react";

export type MenuItem = {
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  danger?: boolean;
  onSelect: () => void;
};

/**
 * Menú contextual: se cierra con Escape o al hacer clic fuera.
 * Con `at` se posiciona en coordenadas de ventana (clic derecho o botón ⋯), ajustado al viewport.
 */
export function PopoverMenu({
  items,
  onClose,
  className = "",
  at,
}: {
  items: MenuItem[];
  onClose: () => void;
  className?: string;
  at?: { x: number; y: number };
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [onClose]);

  const height = items.length * 30 + 8;
  const style = at
    ? { position: "fixed" as const, left: Math.min(at.x, window.innerWidth - 276), top: Math.min(at.y, window.innerHeight - height - 8) }
    : undefined;
  return (
    <div
      ref={ref}
      role="menu"
      style={style}
      className={`z-50 min-w-[265px] rounded-[10px] bg-[var(--popover)] p-1 text-[14px] shadow-[var(--shadow-pop)] ${className}`}
    >
      {items.map((it) => (
        <button
          key={it.label}
          role="menuitem"
          onClick={() => {
            onClose();
            it.onSelect();
          }}
          className={`flex h-[30px] w-full items-center gap-2 rounded-md px-2 text-left hover:bg-hover ${it.danger ? "text-danger" : ""}`}
        >
          <span className="flex w-5 justify-center text-ink-2">{it.icon}</span>
          <span className="flex-1">{it.label}</span>
          {it.shortcut && <span className="text-[12px] text-ink-3">{it.shortcut}</span>}
        </button>
      ))}
    </div>
  );
}
