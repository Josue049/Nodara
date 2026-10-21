export type TreePage = {
  id: string;
  parentId: string | null;
  title: string;
  icon: string | null;
  position: number;
  isFavorite: boolean;
  kind: string;
  /** Nivel de acceso del usuario actual: none | view | comment | edit | full. */
  level?: string;
  /** Alcance efectivo: private | workspace. */
  scope?: string;
  creatorId?: string | null;
  cover?: string | null;
  /** ISO: última edición. */
  updatedAt?: string;
  /** ISO: última visita del usuario actual. */
  viewedAt?: string | null;
};

export function childrenOf(pages: TreePage[], parentId: string | null): TreePage[] {
  return pages
    .filter((p) => p.parentId === parentId)
    .sort((a, b) => a.position - b.position);
}

/** Cadena de ancestros desde la raíz hasta la página (incluida). */
export function pathTo(pages: TreePage[], id: string): TreePage[] {
  const byId = new Map(pages.map((p) => [p.id, p]));
  const out: TreePage[] = [];
  let cur = byId.get(id);
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return out;
}
