"use client";

import { useEffect } from "react";
import { applyTheme, readThemeChoice, syncFavicon, THEME_KEY } from "@/lib/theme";

/**
 * Mantiene el tema coherente fuera del primer pintado: favicon según el tema activo, cambios hechos en otra pestaña
 * (evento `storage`) y cambios del sistema cuando la elección es «sistema». No guarda nada por su cuenta.
 */
export function ThemeSync() {
  useEffect(() => {
    const html = document.documentElement;
    const current = () => (html.dataset.theme === "dark" ? "dark" : "light");
    syncFavicon(current());
    // Cualquier cambio de data-theme (conmutador, otra pestaña, sistema) actualiza el favicon sin recargar.
    const obs = new MutationObserver(() => syncFavicon(current()));
    obs.observe(html, { attributes: true, attributeFilter: ["data-theme"] });
    // Next vuelve a insertar o restaurar las etiquetas de metadatos al hidratar y navegar: se corrigen al momento
    // (syncFavicon solo escribe si el href difiere, así que no hay bucle).
    obs.observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ["href"] });
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_KEY || e.key === null) applyTheme(readThemeChoice(), false);
    };
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystem = () => {
      if (readThemeChoice() === "system") applyTheme("system", false);
    };
    window.addEventListener("storage", onStorage);
    mq.addEventListener("change", onSystem);
    return () => {
      obs.disconnect();
      window.removeEventListener("storage", onStorage);
      mq.removeEventListener("change", onSystem);
    };
  }, []);
  return null;
}
