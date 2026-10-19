"use client";

import { createContext, useContext } from "react";

export type AccessLevel = "none" | "view" | "comment" | "edit" | "full";

export type Access = {
  level: AccessLevel;
  /** Presente cuando se navega por un enlace público (sin sesión). */
  publicToken?: string;
};

export const AccessContext = createContext<Access>({ level: "edit" });

/** Qué puede hacer el usuario en la página actual (lo comprueba también el servidor en cada petición). */
export function useAccess() {
  const a = useContext(AccessContext);
  return {
    ...a,
    canEdit: a.level === "edit" || a.level === "full",
    canComment: a.level === "comment" || a.level === "edit" || a.level === "full",
    canManage: a.level === "full",
  };
}
