"use client";

import { Copy, Globe, Lock, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { call } from "./database/api";
import { Popover, type Anchor } from "./database/popover";
import { Avatar } from "./settings-dialog";

type Level = "view" | "comment" | "edit" | "full";
type Person = { userId: string; name: string; email: string; avatarColor: string; level: Level; source: "creator" | "explicit" | "inherited"; isSelf: boolean };
type Info = { scope: "private" | "workspace"; scopeIsOwn: boolean; yourLevel: string; people: Person[]; publicLink: { token: string; level: "view" | "comment" | "edit" } | null };

export const LEVEL_LABELS: Record<Level, string> = { full: "Acceso completo", edit: "Puede editar", comment: "Puede comentar", view: "Puede ver" };
const field = "h-8 rounded-md border border-line bg-transparent px-2 outline-none focus:border-accent";

/** Diálogo «Compartir» (pestañas Compartir/Publicar, invitar por correo, lista de personas, acceso general, copiar enlace). */
export function ShareDialog({ pageId, anchor, onClose, onChanged }: { pageId: string; anchor: Anchor; onClose: () => void; onChanged?: () => void }) {
  const [tab, setTab] = useState<"share" | "publish">("share");
  const [info, setInfo] = useState<Info | null>(null);
  const [email, setEmail] = useState("");
  const [level, setLevel] = useState<Level>("edit");
  const [error, setError] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => setInfo(await call<Info>(`/api/pages/${pageId}/sharing`)), [pageId]);
  useEffect(() => {
    let alive = true;
    call<Info>(`/api/pages/${pageId}/sharing`).then((i) => alive && setInfo(i)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [pageId]);

  const manage = info?.yourLevel === "full";
  const run = async (fn: () => Promise<unknown>) => {
    setError("");
    try {
      await fn();
      await load();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  };
  const publicUrl = info?.publicLink ? `${window.location.origin}/s/${info.publicLink.token}` : "";

  return (
    <Popover anchor={anchor} onClose={onClose} label="Compartir" testId="share-dialog" width={460} align="right">
      <div className="p-2">
        <div role="tablist" className="mb-3 flex gap-4 border-b border-line px-1">
          {(
            [
              ["share", "Compartir"],
              ["publish", "Publicar"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} data-testid={`share-tab-${id}`} onClick={() => setTab(id)} className={`-mb-px border-b-2 pb-2 ${tab === id ? "border-ink font-medium" : "border-transparent text-ink-3"}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === "share" && info && (
          <div className="flex flex-col gap-3">
            {manage && (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!email.trim()) return;
                  void run(async () => {
                    const r = await call<{ status: string; token?: string }>(`/api/pages/${pageId}/share`, "POST", { email, level });
                    setInviteLink(r.status === "invited" ? `${window.location.origin}/invite/${r.token}` : "");
                    setEmail("");
                  });
                }}
              >
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo electrónico" aria-label="Correo electrónico" data-testid="share-email" className={`${field} min-w-0 flex-1`} />
                <select value={level} onChange={(e) => setLevel(e.target.value as Level)} aria-label="Nivel de acceso a conceder" className={field}>
                  {(["view", "comment", "edit", "full"] as Level[]).map((l) => (
                    <option key={l} value={l}>
                      {LEVEL_LABELS[l]}
                    </option>
                  ))}
                </select>
                <button type="submit" data-testid="share-submit" className="h-8 rounded-md bg-accent px-3 font-medium text-white">
                  Compartir
                </button>
              </form>
            )}
            {inviteLink && (
              <p className="rounded-md bg-hover p-2 text-[13px]" data-testid="share-invite-link">
                Esa persona aún no tiene cuenta. Envíale este enlace de invitación: <span className="break-all font-mono">{inviteLink}</span>
              </p>
            )}
            {error && (
              <p role="alert" className="text-[13px] text-danger" data-testid="share-error">
                {error}
              </p>
            )}

            <ul className="flex flex-col" data-testid="share-people">
              {info.people.map((p) => (
                <li key={p.userId} className="flex items-center gap-2.5 py-1.5" data-testid="share-person" data-email={p.email}>
                  <Avatar name={p.name} color={p.avatarColor} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">
                      {p.name}
                      {p.isSelf && <span className="text-ink-3"> (Tú)</span>}
                    </p>
                    <p className="truncate text-[12px] text-ink-3">{p.email}</p>
                  </div>
                  {manage && p.source !== "creator" ? (
                    <select
                      value={p.level}
                      aria-label={`Acceso de ${p.name}`}
                      onChange={(e) => void run(() => (e.target.value === "none" ? call(`/api/pages/${pageId}/permissions/${p.userId}`, "DELETE") : call(`/api/pages/${pageId}/permissions/${p.userId}`, "PATCH", { level: e.target.value })))}
                      className={field}
                    >
                      {(["full", "edit", "comment", "view"] as Level[]).map((l) => (
                        <option key={l} value={l}>
                          {LEVEL_LABELS[l]}
                        </option>
                      ))}
                      {p.source === "explicit" && <option value="none">Quitar acceso</option>}
                    </select>
                  ) : (
                    <span className="text-[13px] text-ink-2">{p.source === "creator" ? "Acceso completo" : LEVEL_LABELS[p.level]}</span>
                  )}
                </li>
              ))}
            </ul>

            <div className="border-t border-line pt-2">
              <p className="mb-1 text-[12px] font-medium text-ink-3">Acceso general</p>
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-md bg-hover">{info.scope === "workspace" ? <Users size={16} /> : <Lock size={16} />}</span>
                <select
                  aria-label="Acceso general"
                  data-testid="general-access"
                  disabled={!manage}
                  value={info.scope}
                  onChange={(e) => void run(() => call(`/api/pages/${pageId}/scope`, "PUT", { scope: e.target.value }))}
                  className={`${field} flex-1 disabled:opacity-60`}
                >
                  <option value="private">Solo las personas invitadas</option>
                  <option value="workspace">Todos en el espacio de trabajo</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-line pt-2">
              <span className="text-[13px] text-ink-3">Nivel: {LEVEL_LABELS[info.yourLevel as Level] ?? info.yourLevel}</span>
              <button
                type="button"
                data-testid="copy-link"
                onClick={async () => {
                  await navigator.clipboard?.writeText(`${window.location.origin}/${pageId}`).catch(() => {});
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 hover:bg-hover"
              >
                <Copy size={14} /> {copied ? "Enlace copiado" : "Copiar enlace"}
              </button>
            </div>
          </div>
        )}

        {tab === "publish" && info && (
          <div className="flex flex-col gap-3" data-testid="publish-panel">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-md bg-hover">
                <Globe size={16} />
              </span>
              <div className="flex-1">
                <p className="font-medium">Publicar en la web</p>
                <p className="text-[12px] text-ink-3">Cualquiera con el enlace podrá abrir esta página y sus subpáginas, sin iniciar sesión.</p>
              </div>
              <input
                type="checkbox"
                role="switch"
                aria-label="Publicar en la web"
                data-testid="publish-switch"
                disabled={!manage}
                checked={!!info.publicLink}
                onChange={(e) => void run(() => (e.target.checked ? call(`/api/pages/${pageId}/publish`, "POST", { level: "view" }) : call(`/api/pages/${pageId}/publish`, "DELETE")))}
                className="size-4 accent-[var(--accent)]"
              />
            </div>
            {info.publicLink && (
              <>
                <label className="flex items-center justify-between text-[14px]">
                  Permiso del enlace público
                  <select
                    value={info.publicLink.level}
                    aria-label="Permiso del enlace público"
                    data-testid="publish-level"
                    onChange={(e) => void run(() => call(`/api/pages/${pageId}/publish`, "POST", { level: e.target.value }))}
                    className={field}
                  >
                    <option value="view">Puede ver</option>
                    <option value="comment">Puede comentar</option>
                    <option value="edit">Puede editar</option>
                  </select>
                </label>
                <div className="flex items-center gap-2 rounded-md bg-hover p-2 text-[13px]">
                  <span className="min-w-0 flex-1 truncate" data-testid="public-url">
                    {publicUrl}
                  </span>
                  <button type="button" aria-label="Copiar enlace público" onClick={() => void navigator.clipboard?.writeText(publicUrl)} className="rounded p-1 hover:bg-active">
                    <Copy size={14} />
                  </button>
                </div>
              </>
            )}
            {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}
          </div>
        )}
      </div>
    </Popover>
  );
}
