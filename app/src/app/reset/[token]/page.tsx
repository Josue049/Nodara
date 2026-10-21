"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<{ email: string; name: string } | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/auth/reset/${token}`).then(async (r) => {
      if (!alive) return;
      if (r.ok) setInfo(await r.json());
      else setInvalid(true);
    });
    return () => {
      alive = false;
    };
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) return setError("Las contraseñas no coinciden");
    setBusy(true);
    const r = await fetch(`/api/auth/reset/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    setBusy(false);
    if (r.ok) return setDone(true);
    const body = await r.json().catch(() => ({}));
    setError((body as { error?: string; issues?: { message: string }[] }).issues?.[0]?.message ?? (body as { error?: string }).error ?? "No se pudo restablecer la contraseña");
  };

  const field = "h-10 rounded-md border border-line bg-transparent px-3 outline-none focus:border-accent";
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="flex w-full max-w-[400px] flex-col gap-4" data-testid="reset-page">
        <span className="flex size-12 items-center justify-center self-center" data-testid="auth-logo">
          <BrandLogo size={48} />
        </span>
        {invalid && (
          <>
            <h1 className="text-center text-[22px] font-bold">Enlace no válido o caducado</h1>
            <p className="text-center text-ink-2">Pide a un administrador de tu espacio que genere un enlace nuevo.</p>
          </>
        )}
        {done && (
          <>
            <h1 className="text-center text-[22px] font-bold">Contraseña actualizada</h1>
            <p className="text-center text-ink-2">Ya puedes iniciar sesión con tu contraseña nueva. Se cerraron las sesiones abiertas de esta cuenta.</p>
            <Link href="/login" data-testid="reset-login" className="flex h-10 items-center justify-center rounded-md bg-accent font-medium text-white">
              Iniciar sesión
            </Link>
          </>
        )}
        {info && !done && (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <h1 className="text-center text-[22px] font-bold">Nueva contraseña</h1>
            <p className="text-center text-ink-2">Cuenta: {info.email}</p>
            <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña nueva (mínimo 8 caracteres)" aria-label="Contraseña nueva" required minLength={8} className={field} />
            <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repite la contraseña" aria-label="Repite la contraseña" required className={field} />
            {error && (
              <p role="alert" className="text-danger">
                {error}
              </p>
            )}
            <button type="submit" disabled={busy} data-testid="reset-submit" className="h-10 rounded-md bg-accent font-medium text-white disabled:opacity-60">
              {busy ? "Guardando…" : "Guardar contraseña"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
