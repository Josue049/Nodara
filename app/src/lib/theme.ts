import { faviconFor, type ResolvedTheme } from "./brand";

export type ThemeChoice = "light" | "dark" | "system";
export const THEME_KEY = "nodara:theme";

export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  if (choice !== "system") return choice;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function readThemeChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

/** Favicon con el isotipo de la variante del tema (todas las etiquetas `icon`, incluida la del .ico). */
export function syncFavicon(theme: ResolvedTheme) {
  const href = faviconFor(theme);
  document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]').forEach((l) => {
    if (l.getAttribute("href") !== href) {
      l.href = href;
      l.type = "image/png";
      l.removeAttribute("sizes");
    }
  });
}

/** Aplica una elección de tema: la guarda, la pinta en <html> y actualiza el favicon. */
export function applyTheme(choice: ThemeChoice, persist = true) {
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, choice);
    } catch {}
  }
  const theme = resolveTheme(choice);
  document.documentElement.dataset.theme = theme;
  syncFavicon(theme);
}

/** Script en línea para aplicar el tema antes de pintar (evita parpadeo). */
export const themeInitScript = `try{var c=localStorage.getItem("${THEME_KEY}")||"system";var d=c==="dark"||(c==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}`;
