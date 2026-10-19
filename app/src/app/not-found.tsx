import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 text-ink">
      <div className="flex max-w-[420px] flex-col items-center gap-3 text-center" data-testid="not-found">
        <h1 className="text-[22px] font-bold">Página no encontrada</h1>
        <p className="text-ink-2">La dirección no existe o ya no tienes acceso.</p>
        <Link href="/" className="flex h-9 items-center rounded-md bg-accent px-4 text-white">
          Ir al inicio
        </Link>
      </div>
    </main>
  );
}
