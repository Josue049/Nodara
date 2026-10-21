"use client";

import { ArrowRight } from "lucide-react";
import { t } from "@/lib/strings";
import { useStartAsGuest } from "../guest";

/** Botón principal de la portada: entra en la aplicación sin cuenta. */
export function GuestButton({ size = "md", label = t.guestTry, testId = "landing-try" }: { size?: "md" | "lg"; label?: string; testId?: string }) {
  const { start, busy, error } = useStartAsGuest();
  const dims = size === "lg" ? "h-12 px-6 text-[17px]" : "h-9 px-3.5 text-[14px]";
  return (
    <span className="inline-flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className={`nd-landing-primary inline-flex items-center gap-2 rounded-lg font-semibold disabled:opacity-60 ${dims}`}
        data-testid={testId}
      >
        {busy ? "Abriendo…" : label}
        {size === "lg" && <ArrowRight size={18} aria-hidden />}
      </button>
      {error && (
        <span role="alert" className="text-[13px] text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
