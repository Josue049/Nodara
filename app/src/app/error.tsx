"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Límite de error de la aplicación: ofrece reintentar sin perder la sesión. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 text-ink">
      <div role="alert" data-testid="error-boundary" className="flex max-w-[420px] flex-col items-center gap-3 text-center">
        <h1 className="text-[22px] font-bold">Algo salió mal</h1>
        <p className="text-ink-2">Ocurrió un error inesperado. Tu contenido guardado no se ha perdido.</p>
        {error.digest && <p className="text-[12px] text-ink-3">Referencia: {error.digest}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={reset} className="h-9 rounded-md bg-accent px-4 text-white">
            Reintentar
          </button>
          <Link href="/" className="flex h-9 items-center rounded-md border border-line px-4 hover:bg-hover">
            Ir al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
