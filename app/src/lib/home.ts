// Lógica pura del panel de inicio: saludo, fechas relativas, páginas recientes y recuentos.
import { pathTo, type TreePage } from "./tree";

export function greeting(hour: number): string {
  if (hour >= 6 && hour < 12) return "Buenos días";
  if (hour >= 12 && hour < 20) return "Buenas tardes";
  return "Buenas noches";
}

const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86_400],
  ["month", 30 * 86_400],
  ["week", 7 * 86_400],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

/** «hace 5 minutos», «ayer», «hace 2 semanas»… Menos de un minuto: «ahora mismo». */
export function relativeTime(iso: string, now = Date.now()): string {
  const secs = Math.round((new Date(iso).getTime() - now) / 1000);
  if (Math.abs(secs) < 60) return "ahora mismo";
  for (const [unit, size] of STEPS) {
    if (Math.abs(secs) >= size) return rtf.format(Math.round(secs / size), unit);
  }
  return "ahora mismo";
}

export type RecentPage = TreePage & { activity: "viewed" | "edited"; at: string; path: string[] };

/**
 * Páginas ordenadas por actividad del usuario: su última visita o, si es posterior o no existe, la última edición
 * (también cuenta las páginas recién creadas).
 */
export function recentPages(pages: TreePage[], limit: number): RecentPage[] {
  return pages
    .map((p): RecentPage => {
      const edited = p.updatedAt ?? "";
      const viewed = p.viewedAt ?? "";
      const activity = viewed && viewed >= edited ? "viewed" : "edited";
      return { ...p, activity, at: activity === "viewed" ? viewed : edited, path: pathTo(pages, p.id).slice(0, -1).map((a) => a.title) };
    })
    .filter((p) => p.at)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}

export type HomeCounts = { pages: number; databases: number; favorites: number; editedThisWeek: number; team: number; private: number; shared: number };

export function homeCounts(pages: TreePage[], userId: string, now = Date.now()): HomeCounts {
  const weekAgo = new Date(now - 7 * 86_400_000).toISOString();
  const ids = new Set(pages.map((p) => p.id));
  const top = pages.filter((p) => !p.parentId || !ids.has(p.parentId));
  return {
    pages: pages.filter((p) => p.kind !== "database").length,
    databases: pages.filter((p) => p.kind === "database").length,
    favorites: pages.filter((p) => p.isFavorite).length,
    editedThisWeek: pages.filter((p) => (p.updatedAt ?? "") >= weekAgo).length,
    // Mismo reparto que la barra lateral: equipo, privado (creado por mí) y compartido conmigo.
    team: top.filter((p) => p.scope === "workspace").length,
    private: top.filter((p) => p.scope !== "workspace" && (p.creatorId ?? userId) === userId).length,
    shared: top.filter((p) => p.scope !== "workspace" && (p.creatorId ?? userId) !== userId).length,
  };
}

/** Degradado estable por página (para tarjetas sin portada), dentro de la paleta azul-lavanda de Nodara. */
const GRADIENTS = [
  "linear-gradient(135deg,#2a2f5c,#6d4ae8)",
  "linear-gradient(135deg,#1d2b53,#3d7be0)",
  "linear-gradient(135deg,#3b2a6b,#b48cf0)",
  "linear-gradient(135deg,#16213e,#5a6fd8)",
  "linear-gradient(135deg,#2d1f4f,#8f6af0)",
  "linear-gradient(135deg,#1b2440,#7a8cf5)",
];

/** Índice estable en [0, n) a partir de un identificador. */
export function pick(id: string, n: number): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % n;
}

export function gradientFor(id: string): string {
  return GRADIENTS[pick(id, GRADIENTS.length)];
}
