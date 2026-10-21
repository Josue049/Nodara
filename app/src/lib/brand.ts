// Recursos de marca de Nodara (extraídos de docs/brand/logos-source.png sin redibujar). Única fuente de rutas.
export type ResolvedTheme = "light" | "dark";

export const BRAND_MARK: Record<ResolvedTheme, { src: string; size: number }> = {
  light: { src: "/brand/nodara-mark-light.png", size: 69 },
  dark: { src: "/brand/nodara-mark-dark.png", size: 81 },
};

export const faviconFor = (theme: ResolvedTheme, size: 16 | 32 | 48 = 32) => `/brand/favicon-${theme}-${size}.png`;
