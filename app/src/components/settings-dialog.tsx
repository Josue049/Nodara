"use client";

import { Copy, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { call } from "./database/api";
import { hardNavigate, useAuth, type WorkspaceInfo } from "./auth-provider";

type Role = WorkspaceInfo["role"];
type Member = { userId: string; name: string; email: string; avatarColor: string; role: Role };
type Pending = { id: string; email: string; role: Role; expiresAt: string };

export type SettingsTab = "account" | "workspace" | "members";

const ROLE_LABELS: Record<Role, string> = { owner: "Propietario", admin: "Administrador", member: "Miembro", guest: "Invitado" };
const field = "h-9 rounded-md border border-line bg-transparent px-2.5 outline-none focus:border-accent";

export function Avatar({ name, color, size = 28 }: { name: string; color: string; size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full font-medium" style={{ width: size, height: size, fontSize: size * 0.45, background: `var(--opt-${color}-bg)`, color: `var(--opt-${color}-fg)` }} aria-hidden>
      {(name || "?").trim().charAt(0).toUpperCase()}
    </span>
  );
}

function AccountTab() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user.name);
  const [msg, setMsg] = useState("");
  const [pw, setPw] = useState({ current: "", next: "" });
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="flex flex-col gap-5" data-testid="settings-account">
      <section className="flex flex-col gap-2">
        <h3 className="font-semibold">Mi perfil</h3>
        <label className="flex flex-col gap-1 text-[14px] text-ink-2">
          Nombre
          <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Nombre" className={field} />
        </label>
        <p className="text-[14px] text-ink-2">Correo: {user.email}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              await call("/api/me", "PATCH", { name });
              await refresh();
              setMsg("Guardado");
            }}
            className="h-8 rounded-md bg-accent px-3 text-white"
          >
            Guardar
          </button>
          {msg && <span role="status" data-testid="settings-status" className="text-[14px] text-ink-3">{msg}</span>}
        </div>
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="font-semibold">Cambiar contraseña</h3>
        <input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} placeholder="Contraseña actual" aria-label="Contraseña actual" autoComplete="current-password" className={field} />
        <input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} placeholder="Nueva contraseña (mínimo 8)" aria-label="Nueva contraseña" autoComplete="new-password" className={field} />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              try {
                await call("/api/me/password", "POST", { current: pw.current, next: pw.next });
                setPw({ current: "", next: "" });
                setPwMsg({ ok: true, text: "Contraseña actualizada" });
              } catch (e) {
                setPwMsg({ ok: false, text: e instanceof Error ? e.message : "Error" });
              }
            }}
            className="h-8 rounded-md border border-line px-3 hover:bg-hover"
          >
            Actualizar contraseña
          </button>
          {pwMsg && (
            <span role={pwMsg.ok ? "status" : "alert"} className={`text-[14px] ${pwMsg.ok ? "text-ink-3" : "text-danger"}`}>
              {pwMsg.text}
            </span>
          )}
        </div>
      </section>
      <section>
        <button type="button" onClick={() => void call("/api/auth/logout", "POST").then(() => hardNavigate("/login"))} className="h-8 rounded-md border border-line px-3 hover:bg-hover">
          Cerrar sesión
        </button>
      </section>
    </div>
  );
}

function WorkspaceTab() {
  const { workspace, refresh } = useAuth();
  const [name, setName] = useState(workspace.name);
  const admin = workspace.role === "owner" || workspace.role === "admin";
  return (
    <div className="flex flex-col gap-4" data-testid="settings-workspace">
      <label className="flex flex-col gap-1 text-[14px] text-ink-2">
        Nombre del espacio de trabajo
        <input value={name} disabled={!admin} onChange={(e) => setName(e.target.value)} aria-label="Nombre del espacio de trabajo" className={`${field} disabled:opacity-60`} />
      </label>
      {admin && (
        <div>
          <button
            type="button"
            onClick={async () => {
              await call(`/api/workspaces/${workspace.id}`, "PATCH", { name });
              await refresh();
            }}
            className="h-8 rounded-md bg-accent px-3 text-white"
          >
            Guardar
          </button>
        </div>
      )}
      {workspace.role === "owner" && (
        <section className="border-t border-line pt-4">
          <h3 className="mb-1 font-semibold text-danger">Zona peligrosa</h3>
          <p className="mb-2 text-[14px] text-ink-2">Eliminar el espacio borra todas sus páginas, bases de datos y archivos para todos los miembros. No se puede deshacer.</p>
          <button
            type="button"
            data-testid="delete-workspace"
            onClick={async () => {
              if (!window.confirm(`¿Eliminar definitivamente «${workspace.name}»?`)) return;
              await call(`/api/workspaces/${workspace.id}`, "DELETE");
              hardNavigate("/");
            }}
            className="h-8 rounded-md border border-danger px-3 text-danger hover:bg-hover"
          >
            Eliminar espacio de trabajo
          </button>
        </section>
      )}
    </div>
  );
}

function MembersTab() {
  const { user, workspace } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const admin = workspace.role === "owner" || workspace.role === "admin";

  const load = useCallback(async () => {
    const r = await call<{ members: Member[]; pending: Pending[] }>(`/api/workspaces/${workspace.id}/members`);
    setMembers(r.members);
    setPending(r.pending);
  }, [workspace.id]);
  useEffect(() => {
    let alive = true;
    call<{ members: Member[]; pending: Pending[] }>(`/api/workspaces/${workspace.id}/members`).then((r) => {
      if (alive) {
        setMembers(r.members);
        setPending(r.pending);
      }
    });
    return () => {
      alive = false;
    };
  }, [workspace.id]);

  return (
    <div className="flex flex-col gap-4" data-testid="settings-members">
      {admin && (
        <form
          className="flex flex-col gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            try {
              const r = await call<{ token: string }>(`/api/workspaces/${workspace.id}/invitations`, "POST", { email, role });
              setLink(`${window.location.origin}/invite/${r.token}`);
              setEmail("");
              await load();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Error");
            }
          }}
        >
          <h3 className="font-semibold">Invitar a miembros</h3>
          <div className="flex gap-2">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo electrónico" aria-label="Correo del invitado" className={`${field} flex-1`} />
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Rol del invitado" className={field}>
              {(["admin", "member", "guest"] as Role[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <button type="submit" className="h-9 rounded-md bg-accent px-3 text-white">
              Invitar
            </button>
          </div>
          {error && <p role="alert" className="text-[14px] text-danger">{error}</p>}
          {link && (
            <div className="flex items-center gap-2 rounded-md bg-hover p-2 text-[13px]" data-testid="invite-link-box">
              <span className="min-w-0 flex-1 truncate" data-testid="invite-link">{link}</span>
              <button type="button" aria-label="Copiar enlace de invitación" onClick={() => void navigator.clipboard?.writeText(link)} className="rounded p-1 hover:bg-active">
                <Copy size={14} />
              </button>
            </div>
          )}
        </form>
      )}
      <section>
        <h3 className="mb-1 font-semibold">Miembros ({members.length})</h3>
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center gap-3 py-2" data-testid="member-row" data-email={m.email}>
              <Avatar name={m.name} color={m.avatarColor} />
              <div className="min-w-0 flex-1">
                <p className="truncate">
                  {m.name}
                  {m.userId === user.id && " (Tú)"}
                </p>
                <p className="truncate text-[13px] text-ink-3">{m.email}</p>
              </div>
              {admin && m.userId !== user.id ? (
                <select
                  value={m.role}
                  aria-label={`Rol de ${m.name}`}
                  onChange={async (e) => {
                    try {
                      await call(`/api/workspaces/${workspace.id}/members/${m.userId}`, "PATCH", { role: e.target.value });
                      setError("");
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Error");
                    }
                    await load();
                  }}
                  className={field}
                >
                  {(["owner", "admin", "member", "guest"] as Role[]).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-[14px] text-ink-2">{ROLE_LABELS[m.role]}</span>
              )}
              {(admin && m.userId !== user.id) || (m.userId === user.id && members.length > 1) ? (
                <button
                  type="button"
                  aria-label={m.userId === user.id ? "Salir del espacio" : `Quitar a ${m.name}`}
                  onClick={async () => {
                    try {
                      await call(`/api/workspaces/${workspace.id}/members/${m.userId}`, "DELETE");
                      if (m.userId === user.id) return hardNavigate("/");
                      await load();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Error");
                    }
                  }}
                  className="rounded p-1 text-ink-3 hover:bg-hover"
                >
                  <Trash2 size={14} />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {error && !admin && <p role="alert" className="text-[14px] text-danger">{error}</p>}
      </section>
      {admin && pending.length > 0 && (
        <section>
          <h3 className="mb-1 font-semibold">Invitaciones pendientes</h3>
          <ul className="divide-y divide-line" data-testid="pending-list">
            {pending.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2">
                <span className="flex-1 truncate">{p.email}</span>
                <span className="text-[14px] text-ink-2">{ROLE_LABELS[p.role]}</span>
                <button type="button" aria-label={`Revocar invitación de ${p.email}`} onClick={async () => (await call(`/api/workspaces/${workspace.id}/invitations/${p.id}`, "DELETE"), load())} className="rounded p-1 text-ink-3 hover:bg-hover">
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function SettingsDialog({ tab, onTab, onClose }: { tab: SettingsTab; onTab: (t: SettingsTab) => void; onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);
  const tabs: [SettingsTab, string][] = [
    ["account", "Mi cuenta"],
    ["workspace", "Espacio de trabajo"],
    ["members", "Miembros"],
  ];
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="Configuración"
        data-testid="settings-dialog"
        onMouseDown={(e) => e.stopPropagation()}
        className="flex h-[min(620px,calc(100vh-48px))] w-[min(820px,calc(100vw-32px))] overflow-hidden rounded-[14px] bg-[var(--popover)] shadow-[var(--shadow-pop)]"
      >
        <nav className="w-[200px] shrink-0 border-r border-line bg-sidebar p-2" aria-label="Secciones">
          <p className="px-2 py-1 text-[12px] font-medium text-ink-3">Configuración</p>
          {tabs.map(([id, label]) => (
            <button key={id} type="button" aria-current={tab === id} data-testid={`settings-tab-${id}`} onClick={() => onTab(id)} className={`flex h-8 w-full items-center rounded-md px-2 text-left ${tab === id ? "bg-active font-medium" : "hover:bg-hover"}`}>
              {label}
            </button>
          ))}
        </nav>
        <div className="nd-scroll relative flex-1 overflow-y-auto p-6">
          <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute right-3 top-3 rounded p-1 hover:bg-hover">
            <X size={16} />
          </button>
          {tab === "account" && <AccountTab />}
          {tab === "workspace" && <WorkspaceTab />}
          {tab === "members" && <MembersTab />}
        </div>
      </div>
    </div>
  );
}
