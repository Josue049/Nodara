import { describe, expect, it } from "vitest";
import { gradientFor, greeting, homeCounts, recentPages, relativeTime } from "@/lib/home";
import type { TreePage } from "@/lib/tree";

const page = (id: string, extra: Partial<TreePage> = {}): TreePage => ({ id, parentId: null, title: id, icon: null, position: 0, isFavorite: false, kind: "page", ...extra });
const NOW = Date.parse("2026-10-20T12:00:00Z");
const ago = (mins: number) => new Date(NOW - mins * 60_000).toISOString();

describe("panel de inicio", () => {
  it("saluda según la hora", () => {
    expect(greeting(7)).toBe("Buenos días");
    expect(greeting(15)).toBe("Buenas tardes");
    expect(greeting(23)).toBe("Buenas noches");
    expect(greeting(3)).toBe("Buenas noches");
  });

  it("formatea fechas relativas en español", () => {
    expect(relativeTime(ago(0.2), NOW)).toBe("ahora mismo");
    expect(relativeTime(ago(5), NOW)).toBe("hace 5 minutos");
    expect(relativeTime(ago(180), NOW)).toBe("hace 3 horas");
    expect(relativeTime(ago(60 * 24), NOW)).toBe("ayer");
  });

  it("ordena las recientes por la actividad más nueva (visita o edición) y añade la ruta", () => {
    const pages = [
      page("a", { updatedAt: ago(60), viewedAt: ago(5) }),
      page("b", { updatedAt: ago(1), viewedAt: null }),
      page("c", { parentId: "a", title: "Hija", updatedAt: ago(30), viewedAt: ago(40) }),
      page("d"), // sin fechas: no aparece
    ];
    const out = recentPages(pages, 10);
    expect(out.map((p) => [p.id, p.activity])).toEqual([
      ["b", "edited"],
      ["a", "viewed"],
      ["c", "edited"],
    ]);
    expect(out[2].path).toEqual(["a"]);
    expect(recentPages(pages, 1)).toHaveLength(1);
  });

  it("cuenta páginas, bases, favoritos, ediciones de la semana y secciones", () => {
    const pages = [
      page("p1", { scope: "workspace", isFavorite: true, updatedAt: ago(10) }),
      page("p2", { scope: "private", creatorId: "yo", updatedAt: ago(60 * 24 * 10) }),
      page("p3", { scope: "private", creatorId: "otra" }),
      page("db", { kind: "database", parentId: "p2", creatorId: "yo" }),
    ];
    expect(homeCounts(pages, "yo", NOW)).toEqual({ pages: 3, databases: 1, favorites: 1, editedThisWeek: 1, team: 1, private: 1, shared: 1 });
  });

  it("asigna un degradado estable por página", () => {
    expect(gradientFor("abc")).toBe(gradientFor("abc"));
    expect(gradientFor("abc")).toMatch(/^linear-gradient/);
  });
});
