"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { t } from "@/lib/strings";
import { hardNavigate } from "./auth-provider";
import { BrandLogo } from "./brand-logo";
import { useStartAsGuest } from "./guest";

export type AuthMode = "login" | "signup";

/** Campos y envío de acceso o registro. Tras el éxito hace una carga completa para que la app arranque con la sesión nueva. */
export function AuthFields({ mode, next = "/", idPrefix = "auth" }: { mode: AuthMode; next?: string; idPrefix?: string }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signup ? { email, name, password } : { email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const issue = body.issues?.[0]?.message;
        throw new Error(issue ?? body.error ?? "No se pudo completar la solicitud");
      }
      hardNavigate(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setBusy(false);
    }
  };

  const field = "h-10 w-full rounded-md border border-line bg-transparent px-3 text-[16px] outline-none focus:border-accent";
  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-3" data-testid={`${mode}-form`} id={`${idPrefix}-${mode}`}>
      {signup && (
        <label className="flex flex-col gap-1 text-[14px] text-ink-2">
          Nombre
          <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" className={field} />
        </label>
      )}
      <label className="flex flex-col gap-1 text-[14px] text-ink-2">
        Correo electrónico
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className={field} />
      </label>
      <label className="flex flex-col gap-1 text-[14px] text-ink-2">
        Contraseña
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={signup ? 8 : undefined}
          autoComplete={signup ? "new-password" : "current-password"}
          className={field}
        />
      </label>
      {error && (
        <p role="alert" className="text-[14px] text-danger" data-testid="auth-error">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className="h-10 rounded-md bg-accent font-medium text-white hover:brightness-95 disabled:opacity-60">
        {busy ? "Un momento…" : signup ? "Crear cuenta" : "Iniciar sesión"}
      </button>
    </form>
  );
}

/** Página completa de acceso o registro. */
export function AuthForm({ mode }: { mode: AuthMode }) {
  const params = useSearchParams();
  const next = params.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const signup = mode === "signup";
  const guest = useStartAsGuest();

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="flex w-full max-w-[380px] flex-col gap-3">
        <div className="mb-2 flex flex-col items-center gap-3">
          <Link href="/bienvenida" className="flex size-12 items-center justify-center" data-testid="auth-logo" aria-label={t.landingHome}>
            <BrandLogo size={48} />
          </Link>
          <h1 className="text-[28px] font-bold">{signup ? "Crea tu cuenta" : "Inicia sesión en Nodara"}</h1>
        </div>
        <AuthFields mode={mode} next={safeNext} />
        <p className="text-center text-[14px] text-ink-2">
          {signup ? "¿Ya tienes cuenta? " : "¿No tienes cuenta? "}
          <Link href={`${signup ? "/login" : "/signup"}${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-accent underline underline-offset-2">
            {signup ? "Inicia sesión" : "Regístrate"}
          </Link>
        </p>
        <div className="flex items-center gap-3 text-[13px] text-ink-3" aria-hidden>
          <span className="h-px flex-1 bg-line" />o<span className="h-px flex-1 bg-line" />
        </div>
        <button type="button" onClick={guest.start} disabled={guest.busy} className="h-10 rounded-md border border-line font-medium hover:bg-hover disabled:opacity-60" data-testid="continue-as-guest">
          {guest.busy ? "Un momento…" : t.guestContinue}
        </button>
        {guest.error && (
          <p role="alert" className="text-center text-[14px] text-danger">
            {guest.error}
          </p>
        )}
      </div>
    </main>
  );
}
