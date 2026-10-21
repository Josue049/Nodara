"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { hardNavigate } from "@/components/auth-provider";
import { BrandLogo } from "@/components/brand-logo";

type Info = { workspaceName: string; role: string; email: string; expired: boolean; used: boolean };
const ROLE: Record<string, string> = { owner: "propietario", admin: "administrador", member: "miembro", guest: "invitado" };

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<Info | null>(null);
  const [missing, setMissing] = useState(false);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetch(`/api/invitations/${token}`).then(async (r) => (r.ok ? alive && setInfo(await r.json()) : alive && setMissing(true)));
    fetch("/api/me").then((r) => alive && setLoggedIn(r.ok));
    return () => {
      alive = false;
    };
  }, [token]);

  const next = encodeURIComponent(`/invite/${token}`);
  const accept = async () => {
    const r = await fetch(`/api/invitations/${token}/accept`, { method: "POST" });
    if (r.ok) return hardNavigate("/");
    setError((await r.json().catch(() => ({}))).error ?? "No se pudo aceptar la invitación");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="flex w-full max-w-[400px] flex-col items-center gap-4 text-center" data-testid="invite-page">
        <span className="flex size-12 items-center justify-center" data-testid="auth-logo">
          <BrandLogo size={48} />
        </span>
        {missing && <h1 className="text-[22px] font-bold">Invitación no encontrada</h1>}
        {info && (
          <>
            <h1 className="text-[24px] font-bold">Te invitaron a {info.workspaceName}</h1>
            <p className="text-ink-2">Te unirás como {ROLE[info.role] ?? info.role}.</p>
            {(info.used || info.expired) && (
              <p role="alert" className="text-danger">
                {info.used ? "Esta invitación ya se usó." : "Esta invitación ha caducado."}
              </p>
            )}
            {!info.used && !info.expired && loggedIn === true && (
              <button type="button" data-testid="accept-invite" onClick={accept} className="h-10 w-full rounded-md bg-accent font-medium text-white">
                Unirme al espacio
              </button>
            )}
            {!info.used && !info.expired && loggedIn === false && (
              <div className="flex w-full flex-col gap-2">
                <Link href={`/signup?next=${next}`} className="flex h-10 items-center justify-center rounded-md bg-accent font-medium text-white">
                  Crear una cuenta
                </Link>
                <Link href={`/login?next=${next}`} className="flex h-10 items-center justify-center rounded-md border border-line hover:bg-hover">
                  Ya tengo cuenta
                </Link>
              </div>
            )}
            {error && <p role="alert" className="text-danger">{error}</p>}
          </>
        )}
      </div>
    </main>
  );
}
