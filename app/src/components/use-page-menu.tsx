"use client";

import { Copy, CopyPlus, FolderInput, Pencil, Star, StarOff, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { t } from "@/lib/strings";
import type { TreePage } from "@/lib/tree";
import type { MenuItem } from "./popover-menu";
import { useWorkspace } from "./workspace-provider";

/** Acciones de página compartidas por el menú contextual de la barra lateral y los atajos. */
export function usePageMenu(activeId: string | null) {
  const { pages, toggleFavorite, duplicatePage, setRenaming, setMoveTarget, moveToTrash } = useWorkspace();
  const router = useRouter();

  const copyLink = useCallback((id: string) => {
    void navigator.clipboard?.writeText(`${window.location.origin}/${id}`).catch(() => {});
  }, []);

  const trash = useCallback(
    async (id: string) => {
      const inside = (() => {
        let cur = activeId ? pages.find((p) => p.id === activeId) : undefined;
        const seen = new Set<string>();
        while (cur && !seen.has(cur.id)) {
          if (cur.id === id) return true;
          seen.add(cur.id);
          cur = cur.parentId ? pages.find((p) => p.id === cur!.parentId) : undefined;
        }
        return false;
      })();
      await moveToTrash(id);
      if (inside) router.push("/");
    },
    [activeId, pages, moveToTrash, router],
  );

  const itemsFor = useCallback(
    (page: TreePage): MenuItem[] => [
      {
        label: page.isFavorite ? t.removeFavorite : t.addFavorite,
        icon: page.isFavorite ? <StarOff size={16} /> : <Star size={16} />,
        onSelect: () => void toggleFavorite(page.id),
      },
      { label: t.copyLink, icon: <Copy size={16} />, onSelect: () => copyLink(page.id) },
      { label: t.duplicate, icon: <CopyPlus size={16} />, shortcut: "Ctrl+D", onSelect: () => void duplicatePage(page.id) },
      { label: t.rename, icon: <Pencil size={16} />, shortcut: "Ctrl+⇧+R", onSelect: () => setRenaming(page.id) },
      { label: t.moveTo, icon: <FolderInput size={16} />, shortcut: "Ctrl+⇧+P", onSelect: () => setMoveTarget(page.id) },
      { label: t.moveToTrash, icon: <Trash2 size={16} />, danger: true, onSelect: () => void trash(page.id) },
    ],
    [toggleFavorite, copyLink, duplicatePage, setRenaming, setMoveTarget, trash],
  );

  return { itemsFor };
}
