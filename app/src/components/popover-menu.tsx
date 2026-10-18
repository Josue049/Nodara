"use client";

import { useEffect, useRef } from "react";

export type MenuItem = {
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  onSelect: () => void;
};

/** Menú contextual mínimo: se cierra con Escape o al hacer clic fuera. */
export function PopoverMenu({
  items,
  onClose,
  className = "",
}: {
  items: MenuItem[];
  onClose: () => void;
  className?: string;
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
  return (
    <div
      ref={ref}
      role="menu"
      className={`z-50 min-w-[220px] rounded-md bg-white p-1 text-sm shadow-[var(--shadow-pop)] ${className}`}
    >
      {items.map((it) => (
        <button
          key={it.label}
          role="menuitem"
          onClick={() => {
            onClose();
            it.onSelect();
          }}
          className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-hover ${it.danger ? "text-danger" : ""}`}
        >
          <span className="flex w-5 justify-center text-ink-2">{it.icon}</span>
          {it.label}
        </button>
      ))}
    </div>
  );
}
