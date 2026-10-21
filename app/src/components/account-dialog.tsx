"use client";

import { CloudUpload } from "lucide-react";
import { useEffect, useState } from "react";
import { t } from "@/lib/strings";
import { useAuth } from "./auth-provider";
import { AuthFields, type AuthMode } from "./auth-form";
import { onAccountDialog } from "./guest";
import { Modal } from "./modal";

const NOTICE_KEY = "nodara:guest-notice";

/** Diálogo para el modo sin cuenta: avisa de que hace falta una cuenta para guardar y permite registrarse o entrar. */
export function AccountDialog({ initial = "signup", onClose }: { initial?: AuthMode; onClose: () => void }) {
  const [mode, setMode] = useState<AuthMode>(initial);
  const tab = (m: AuthMode, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === m}
      aria-controls="account-panel"
      onClick={() => setMode(m)}
      className={`h-8 flex-1 rounded-md text-[14px] font-medium ${mode === m ? "bg-[var(--popover)] shadow-[var(--home-shadow-sm)]" : "text-ink-2 hover:text-ink"}`}
      data-testid={`account-tab-${m}`}
    >
      {label}
    </button>
  );
  return (
    <Modal label={t.guestDialogLabel} testId="account-dialog" onClose={onClose} width={420}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2 pt-2 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-[var(--home-chip)] text-[var(--brand-link)]" aria-hidden>
            <CloudUpload size={22} />
          </span>
          <h2 className="text-[20px] font-bold">{t.guestDialogTitle}</h2>
          <p className="text-ink-2" data-testid="account-dialog-warning">
            {t.guestDialogBody}
          </p>
          <p className="text-[13px] text-ink-3">{t.guestDialogKeep}</p>
        </div>
        <div role="tablist" aria-label={t.guestDialogLabel} className="flex gap-1 rounded-lg bg-hover p-1">
          {tab("signup", t.guestTabSignup)}
          {tab("login", t.guestTabLogin)}
        </div>
        <div id="account-panel" role="tabpanel">
          <AuthFields key={mode} mode={mode} idPrefix="account" />
        </div>
        <button type="button" onClick={onClose} className="h-9 rounded-md text-ink-2 hover:bg-hover" data-testid="account-later">
          {t.guestLater}
        </button>
      </div>
    </Modal>
  );
}

/** En modo sin cuenta muestra el aviso al entrar (una vez por sesión del navegador) y cuando se pide desde la interfaz. */
export function AccountHost() {
  const { user } = useAuth();
  const [open, setOpen] = useState<AuthMode | null>(null);
  useEffect(() => {
    if (!user.isGuest) return;
    let seen = false;
    try {
      seen = sessionStorage.getItem(NOTICE_KEY) === "1";
      sessionStorage.setItem(NOTICE_KEY, "1");
    } catch {}
    // Al montar, solo la primera vez: abrir el aviso es una sincronización con el almacenamiento de la sesión.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!seen) setOpen("signup");
    return onAccountDialog(setOpen);
  }, [user.isGuest]);
  if (!user.isGuest || !open) return null;
  return <AccountDialog initial={open} onClose={() => setOpen(null)} />;
}
