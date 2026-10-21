"use client";

import { Check, ChevronDown, CloudUpload, LogOut, Mail, Plus, Settings } from "lucide-react";
import { useRef, useState } from "react";
import { t } from "@/lib/strings";
import { useAuth } from "./auth-provider";
import { anchorOf, MenuRow, Popover, type Anchor } from "./database/popover";
import { openAccountDialog } from "./guest";
import { useWorkspace } from "./workspace-provider";

const ROLE_LABELS = { owner: "Propietario", admin: "Administrador", member: "Miembro", guest: "Invitado" } as const;

/** Selector de espacio de trabajo (tarjeta del espacio, Configuración, Invitar, lista de espacios, Nuevo espacio, Cerrar sesión). */
export function WorkspaceMenu() {
  const { user, workspace, workspaces, switchWorkspace, createWorkspace, logout } = useAuth();
  const { setSettings } = useWorkspace();
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const btn = useRef<HTMLButtonElement>(null);
  const close = () => {
    setAnchor(null);
    setCreating(false);
  };
  const admin = workspace.role === "owner" || workspace.role === "admin";

  return (
    <>
      <button
        ref={btn}
        type="button"
        data-testid="workspace-switcher"
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        onClick={() => btn.current && setAnchor(anchorOf(btn.current))}
        className="flex h-[32px] min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 hover:bg-hover"
      >
        <span className="flex size-[22px] shrink-0 items-center justify-center rounded bg-ink text-[13px] font-semibold text-[var(--bg)]">{(workspace.name || "N").charAt(0).toUpperCase()}</span>
        <span className="truncate text-[14px] font-medium" data-testid="workspace-name">
          {workspace.name}
        </span>
        <ChevronDown size={14} className="shrink-0 text-ink-3" />
      </button>
      {anchor && (
        <Popover anchor={anchor} onClose={close} label="Espacios de trabajo" testId="workspace-menu" width={300}>
          <div className="flex items-center gap-3 border-b border-line px-2 pb-2 pt-1">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-hover text-[18px] font-semibold">{workspace.name.charAt(0).toUpperCase()}</span>
            <div className="min-w-0">
              <p className="truncate font-medium">{workspace.name}</p>
              <p className="truncate text-[12px] text-ink-3">
                {ROLE_LABELS[workspace.role]} · {workspace.memberCount} {workspace.memberCount === 1 ? "miembro" : "miembros"}
              </p>
            </div>
          </div>
          <div className="py-1">
            <MenuRow icon={<Settings size={16} />} onClick={() => (close(), setSettings("workspace"))} testId="open-settings">
              Configuración
            </MenuRow>
            {admin && (
              <MenuRow icon={<Mail size={16} />} onClick={() => (close(), setSettings("members"))} testId="invite-members">
                Invitar a miembros
              </MenuRow>
            )}
          </div>
          <div className="border-t border-line py-1">
            <p className="truncate px-2 py-1 text-[12px] text-ink-3" data-testid="account-email">
              {user.isGuest ? t.guestBadge : user.email}
            </p>
            {user.isGuest && (
              <MenuRow icon={<CloudUpload size={16} />} onClick={() => (close(), openAccountDialog("signup"))} testId="guest-save-menu">
                <span className="text-accent">{t.guestSave}</span>
              </MenuRow>
            )}
            {workspaces.map((w) => (
              <MenuRow key={w.id} testId="workspace-item" onClick={() => (w.id === workspace.id ? close() : void switchWorkspace(w.id))} right={w.id === workspace.id ? <Check size={14} /> : null}>
                {w.name}
              </MenuRow>
            ))}
            {creating ? (
              <form
                className="flex gap-1 px-1 py-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (name.trim()) void createWorkspace(name.trim());
                }}
              >
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del espacio" aria-label="Nombre del nuevo espacio" className="h-8 min-w-0 flex-1 rounded-md border border-line bg-transparent px-2 outline-none focus:border-accent" />
                <button type="submit" className="h-8 rounded-md bg-accent px-2 text-white">
                  Crear
                </button>
              </form>
            ) : (
              <MenuRow icon={<Plus size={16} />} onClick={() => setCreating(true)} testId="new-workspace">
                <span className="text-accent">Nuevo espacio de trabajo</span>
              </MenuRow>
            )}
          </div>
          <div className="border-t border-line pt-1">
            <MenuRow icon={<LogOut size={16} />} onClick={() => (!user.isGuest || window.confirm(t.guestDiscardConfirm)) && void logout()} testId="logout">
              {user.isGuest ? t.guestDiscard : "Cerrar sesión"}
            </MenuRow>
          </div>
        </Popover>
      )}
    </>
  );
}
