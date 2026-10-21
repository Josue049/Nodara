"use client";

import { useState } from "react";
import { hardNavigate } from "./auth-provider";

/** Abre la aplicación sin cuenta: el servidor crea una cuenta temporal y su sesión. */
export function useStartAsGuest(next = "/") {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const start = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/guest", { method: "POST" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "No se pudo abrir Nodara sin cuenta");
      hardNavigate(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setBusy(false);
    }
  };
  return { start, busy, error };
}

const OPEN_EVENT = "nodara:account-dialog";

/** Pide abrir el diálogo «Guarda tus proyectos» (lo pinta `AccountHost`). */
export const openAccountDialog = (mode: "signup" | "login" = "signup") => window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: mode }));
export const onAccountDialog = (fn: (mode: "signup" | "login") => void) => {
  const listener = (e: Event) => fn((e as CustomEvent).detail);
  window.addEventListener(OPEN_EVENT, listener);
  return () => window.removeEventListener(OPEN_EVENT, listener);
};
