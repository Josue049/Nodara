"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";
import { useWorkspace } from "./workspace-provider";

/** Atajos globales observados en el menú de Notion: Ctrl+K, Ctrl+D, Ctrl+⇧+R, Ctrl+⇧+P. */
export function GlobalShortcuts() {
  const { setSearchOpen, duplicatePage, setRenaming, setMoveTarget } = useWorkspace();
  const params = useParams<{ pageId?: string }>();
  const id = params.pageId ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "k" && !e.shiftKey) {
        e.preventDefault();
        setSearchOpen(true);
      } else if (id && k === "d" && !e.shiftKey) {
        e.preventDefault();
        void duplicatePage(id);
      } else if (id && k === "r" && e.shiftKey) {
        e.preventDefault();
        setRenaming(id);
      } else if (id && k === "p" && e.shiftKey) {
        e.preventDefault();
        setMoveTarget(id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id, setSearchOpen, duplicatePage, setRenaming, setMoveTarget]);
  return null;
}
