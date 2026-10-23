// Paleta de colores de texto y de fondo. Los valores son variables CSS (globals.css) con un tono propio por tema.
export type Swatch = { id: string; name: string; text: string | null; bg: string | null };

const swatch = (id: string, name: string): Swatch => ({ id, name, text: `var(--tx-${id})`, bg: `var(--bgc-${id})` });

/** Colores con variante de texto y de fondo. */
export const SWATCHES: Swatch[] = [
  { id: "default", name: "Predeterminado", text: null, bg: null },
  swatch("gray", "Gris"),
  swatch("brown", "Marrón"),
  swatch("orange", "Naranja"),
  swatch("yellow", "Amarillo"),
  swatch("green", "Verde"),
  swatch("blue", "Azul"),
  swatch("purple", "Morado"),
  swatch("pink", "Rosa"),
  swatch("red", "Rojo"),
];

/** Negro puro: solo como color de texto (en el tema oscuro se muestra con el máximo contraste). */
export const BLACK: Swatch = { id: "black", name: "Negro", text: "var(--tx-black)", bg: null };

/** Colores de texto en el orden de los menús: predeterminado, negro y el resto. */
export const TEXT_SWATCHES: Swatch[] = [SWATCHES[0], BLACK, ...SWATCHES.slice(1)];

/** Valores fijos del tema claro, para exportar a HTML (fuera de la app no existen las variables). */
export const LIGHT: Record<string, { text: string; bg?: string }> = {
  black: { text: "#000000" },
  gray: { text: "#787774", bg: "#f1f1ef" },
  brown: { text: "#9f6b53", bg: "#f4eeee" },
  orange: { text: "#d9730d", bg: "#fbecdd" },
  yellow: { text: "#cb912f", bg: "#fbf3db" },
  green: { text: "#448361", bg: "#edf3ec" },
  blue: { text: "#337ea9", bg: "#e7f3f8" },
  purple: { text: "#9065b0", bg: "#f6f3f9" },
  pink: { text: "#c14c8a", bg: "#f9f0f5" },
  red: { text: "#d44c47", bg: "#fdebec" },
};

// Documentos anteriores guardaron el hex del tema claro: se traduce a la variable para que siga el tema.
const LEGACY = new Map<string, string>();
for (const [id, v] of Object.entries(LIGHT)) {
  if (id === "black") continue;
  LEGACY.set(v.text, `var(--tx-${id})`);
  if (v.bg) LEGACY.set(v.bg, `var(--bgc-${id})`);
}

/** Valor CSS con el que se pinta un color guardado (variable del tema si se conoce). */
export function themedColor(value: string): string {
  return LEGACY.get(value.toLowerCase()) ?? value;
}

/** Valor fijo (hex) de un color guardado, para exportaciones fuera de la app. */
export function staticColor(value: string): string {
  const m = /^var\(--(tx|bgc)-([a-z]+)\)$/.exec(value);
  if (!m) return value;
  const c = LIGHT[m[2]];
  return (m[1] === "tx" ? c?.text : c?.bg) ?? value;
}

/** Color guardado → muestra de la paleta (para marcar la opción activa). */
export function swatchOf(value: string | null | undefined, kind: "text" | "bg"): Swatch | undefined {
  if (!value) return SWATCHES[0];
  const v = themedColor(value);
  return (kind === "text" ? TEXT_SWATCHES : SWATCHES).find((s) => (kind === "text" ? s.text : s.bg) === v);
}
