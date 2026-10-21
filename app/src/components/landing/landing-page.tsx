import { Blocks, Check, CloudOff, Download, GitBranch, LayoutTemplate, Lock, MessageSquare, Search, Server, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { BrandLogo } from "../brand-logo";
import { FeatureTabs } from "./feature-tabs";
import { GuestButton } from "./guest-button";
import { ProductMock } from "./product-mock";

/**
 * Portada comercial de Nodara. Sigue la estructura habitual de una portada de producto (cabecera, titular con llamada
 * a la acción, ilustración del producto, pestañas de funciones, cuadrícula, planes, llamada final y pie); textos e
 * ilustraciones son propios. Todas las funciones que se anuncian existen en la aplicación.
 */

const NAV = [
  { href: "#funciones", label: "Funciones" },
  { href: "#equipos", label: "Equipos" },
  { href: "#open-source", label: "Open source" },
  { href: "#planes", label: "Planes" },
];

const USES = ["Estudiantes", "Equipos de producto", "Startups", "Agencias", "ONG", "Investigación", "Escritores", "Docentes"];

const GRID = [
  { icon: Blocks, title: "Editor por bloques", body: "Más de 30 tipos de bloque, arrastrar y soltar y atajos de teclado." },
  { icon: Users, title: "Colaboración en vivo", body: "Edita a la vez con tu equipo, con cursores y presencia en tiempo real." },
  { icon: MessageSquare, title: "Comentarios y menciones", body: "Hilos anclados al texto, respuestas, resolución y bandeja de entrada." },
  { icon: LayoutTemplate, title: "Plantillas", body: "Empieza con plantillas integradas o guarda las tuyas." },
  { icon: CloudOff, title: "Sin conexión", body: "Sigue escribiendo sin red: los cambios se fusionan al volver." },
  { icon: Search, title: "Búsqueda avanzada", body: "Encuentra cualquier página por contenido, autor, fecha o tipo." },
  { icon: Lock, title: "Permisos por página", body: "Roles por espacio, permisos heredables, bloqueo y enlaces públicos." },
  { icon: Download, title: "Importa y exporta", body: "Markdown, HTML, JSON y CSV. Tus datos nunca quedan atrapados." },
];

const PLANS = [
  { name: "Personal", price: "0 €", note: "para siempre", items: ["Páginas y bloques ilimitados", "Bases de datos con seis vistas", "Importar y exportar", "Prueba sin cuenta"], cta: "guest" as const },
  { name: "Equipos", price: "0 €", note: "autoalojado", items: ["Espacios y miembros ilimitados", "Colaboración en tiempo real", "Permisos, auditoría y analíticas", "PostgreSQL y Docker"], cta: "signup" as const },
];

function SectionTitle({ eyebrow, title, body }: { eyebrow?: string; title: string; body?: string }) {
  return (
    <div className="mx-auto mb-10 flex max-w-[720px] flex-col items-center gap-3 text-center">
      {eyebrow && <p className="text-[14px] font-semibold uppercase tracking-[0.08em] text-[var(--brand-link)]">{eyebrow}</p>}
      <h2 className="text-[34px] font-bold leading-[1.1] tracking-[-0.02em] sm:text-[44px]">{title}</h2>
      {body && <p className="text-[18px] text-ink-2">{body}</p>}
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="nd-landing min-h-screen bg-[var(--bg)] text-ink" data-testid="landing">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded focus:bg-[var(--popover)] focus:px-3 focus:py-2">
        Saltar al contenido
      </a>
      <header className="sticky top-0 z-40 border-b border-[var(--landing-border)] bg-[var(--landing-header)] backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-6 px-4 sm:px-6">
          <Link href="/bienvenida" className="flex items-center gap-2 text-[18px] font-bold" aria-label="Nodara, portada">
            <BrandLogo size={28} />
            <span aria-hidden>Nodara</span>
          </Link>
          <nav aria-label="Secciones" className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="rounded-md px-3 py-1.5 text-[15px] text-ink-2 hover:bg-hover hover:text-ink">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/login" className="rounded-md px-2 py-1.5 text-[14px] font-medium hover:bg-hover sm:px-3 sm:text-[15px]" data-testid="landing-login">
              Iniciar sesión
            </Link>
            <GuestButton label="Probar gratis" testId="landing-try-header" />
          </div>
        </div>
      </header>

      <main id="contenido">
        <section className="mx-auto max-w-[1200px] px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
          <p className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--landing-border)] px-3 py-1 text-[13px] text-ink-2">
            <span className="size-1.5 rounded-full bg-[#28c840]" aria-hidden />
            Open source · sin cuenta para empezar
          </p>
          <h1 className="mx-auto max-w-[900px] text-[44px] font-bold leading-[1.04] tracking-[-0.03em] sm:text-[68px]">
            Tu espacio de trabajo
            <br className="hidden sm:block" /> <span className="text-[var(--brand-link)]">todo en uno</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-[640px] text-[19px] text-ink-2 sm:text-[21px]">Documentos, wikis, proyectos y bases de datos conectados en un solo lugar. Escribe, planifica y organiza con tu equipo.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <GuestButton size="lg" />
            <Link href="/signup" className="inline-flex h-12 items-center rounded-lg px-5 text-[17px] font-semibold text-[var(--brand-link)] hover:bg-[var(--home-chip)]" data-testid="landing-signup">
              Crear una cuenta
            </Link>
          </div>
          <p className="mt-3 text-[14px] text-ink-3">Sin tarjeta y sin registro. Crea una cuenta solo cuando quieras guardar tus proyectos.</p>
          <div className="relative mx-auto mt-14 max-w-[1040px]">
            <div className="nd-landing-glow pointer-events-none absolute -inset-x-10 -top-10 bottom-10 -z-0 rounded-[40px]" aria-hidden />
            <div className="relative">
              <ProductMock />
            </div>
          </div>
        </section>

        <section aria-label="Para quién es Nodara" className="border-y border-[var(--landing-border)] py-8">
          <p className="mb-4 text-center text-[14px] text-ink-3">Para cualquiera que necesite ordenar ideas y trabajo</p>
          <ul className="mx-auto flex max-w-[1000px] flex-wrap justify-center gap-x-8 gap-y-3 px-4 text-[17px] font-semibold text-ink-2">
            {USES.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </section>

        <section id="funciones" className="mx-auto max-w-[1200px] scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
          <SectionTitle eyebrow="Funciones" title="Una herramienta. Todas tus formas de trabajar." body="Combina páginas, bloques y bases de datos como piezas de construcción." />
          <FeatureTabs />
        </section>

        <section id="equipos" className="scroll-mt-20 bg-[var(--landing-band)] py-20 sm:py-28">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
            <SectionTitle eyebrow="Para equipos" title="Todo lo que tu equipo necesita, sin extras de pago" />
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {GRID.map((g) => {
                const Icon = g.icon;
                return (
                  <li key={g.title} className="flex flex-col gap-2 rounded-2xl border border-[var(--landing-border)] bg-[var(--bg)] p-5 text-left">
                    <span className="mb-1 flex size-10 items-center justify-center rounded-xl bg-[var(--home-chip)] text-[var(--brand-link)]" aria-hidden>
                      <Icon size={20} />
                    </span>
                    <h3 className="text-[17px] font-semibold">{g.title}</h3>
                    <p className="text-[15px] text-ink-2">{g.body}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section id="open-source" className="mx-auto max-w-[1200px] scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div className="flex flex-col gap-4 text-left">
              <p className="text-[14px] font-semibold uppercase tracking-[0.08em] text-[var(--brand-link)]">Open source</p>
              <h2 className="text-[34px] font-bold leading-[1.1] tracking-[-0.02em] sm:text-[44px]">Tus datos, en tu servidor.</h2>
              <p className="text-[18px] text-ink-2">Nodara es software libre. Instálalo en tu propia infraestructura, con PostgreSQL y Docker, y conserva el control de todo lo que escribes.</p>
              <ul className="mt-2 flex flex-col gap-3 text-[16px]">
                {[
                  { icon: Server, text: "Autoalojado con PostgreSQL o base embebida" },
                  { icon: ShieldCheck, text: "Contraseñas con scrypt, CSP estricta y sesiones seguras" },
                  { icon: GitBranch, text: "Código abierto: audítalo y adáptalo a tu equipo" },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-3">
                    <Icon size={18} className="shrink-0 text-[var(--brand-link)]" aria-hidden />
                    {text}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-[var(--landing-border)] bg-[var(--pre-bg)] p-5 text-left font-mono text-[13px] leading-6 text-ink-2 shadow-[var(--landing-shadow)]" aria-label="Ejemplo de instalación con Docker">
              <p className="text-ink-3"># Arranca Nodara en tu servidor</p>
              <p>
                <span className="text-[var(--brand-link)]">$</span> docker compose up -d
              </p>
              <p className="text-ink-3"># Listo en http://localhost:3000</p>
            </div>
          </div>
        </section>

        <section id="planes" className="scroll-mt-20 bg-[var(--landing-band)] py-20 sm:py-28">
          <div className="mx-auto max-w-[900px] px-4 sm:px-6">
            <SectionTitle eyebrow="Planes" title="Gratis. De verdad." body="Sin límites artificiales ni funciones bloqueadas." />
            <ul className="grid gap-4 md:grid-cols-2">
              {PLANS.map((p) => (
                <li key={p.name} className="flex flex-col gap-4 rounded-2xl border border-[var(--landing-border)] bg-[var(--bg)] p-6 text-left">
                  <h3 className="text-[20px] font-semibold">{p.name}</h3>
                  <p>
                    <span className="text-[40px] font-bold tracking-[-0.02em]">{p.price}</span> <span className="text-ink-2">{p.note}</span>
                  </p>
                  <ul className="flex flex-1 flex-col gap-2 text-[15px]">
                    {p.items.map((i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check size={16} className="mt-1 shrink-0 text-[var(--brand-link)]" aria-hidden />
                        {i}
                      </li>
                    ))}
                  </ul>
                  {p.cta === "guest" ? (
                    <GuestButton label="Empezar sin cuenta" testId="landing-try-plan" />
                  ) : (
                    <Link href="/signup" className="inline-flex h-9 w-fit items-center rounded-lg border border-[var(--landing-border)] px-3.5 text-[14px] font-semibold hover:bg-hover">
                      Crear una cuenta
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-[1200px] px-4 py-24 text-center sm:px-6 sm:py-32">
          <span className="mx-auto mb-6 flex size-16 items-center justify-center" aria-hidden>
            <BrandLogo size={64} />
          </span>
          <h2 className="mx-auto max-w-[720px] text-[38px] font-bold leading-[1.08] tracking-[-0.02em] sm:text-[56px]">Empieza ahora. Sin cuenta.</h2>
          <p className="mx-auto mt-4 max-w-[560px] text-[18px] text-ink-2">Prueba todas las funciones al instante. Cuando quieras guardar tus proyectos, crea tu cuenta y lo conservas todo.</p>
          <div className="mt-8 flex justify-center">
            <GuestButton size="lg" testId="landing-try-final" />
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--landing-border)]">
        <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-12 sm:grid-cols-[1.5fr_1fr_1fr_1fr] sm:px-6">
          <div className="flex flex-col gap-3">
            <span className="flex items-center gap-2 text-[17px] font-bold">
              <BrandLogo size={24} />
              Nodara
            </span>
            <p className="max-w-[260px] text-[14px] text-ink-2">El espacio de trabajo open source para documentos, wikis y proyectos.</p>
          </div>
          {[
            { title: "Producto", links: NAV.slice(0, 2) },
            { title: "Proyecto", links: NAV.slice(2) },
            {
              title: "Cuenta",
              links: [
                { href: "/login", label: "Iniciar sesión" },
                { href: "/signup", label: "Registrarse" },
              ],
            },
          ].map((col) => (
            <nav key={col.title} aria-label={col.title} className="flex flex-col gap-2 text-[14px]">
              <p className="font-semibold">{col.title}</p>
              {col.links.map((l) =>
                l.href.startsWith("#") ? (
                  <a key={l.href} href={l.href} className="text-ink-2 hover:text-ink">
                    {l.label}
                  </a>
                ) : (
                  <Link key={l.href} href={l.href} className="text-ink-2 hover:text-ink">
                    {l.label}
                  </Link>
                ),
              )}
            </nav>
          ))}
        </div>
        <p className="border-t border-[var(--landing-border)] px-4 py-5 text-center text-[13px] text-ink-3">© 2026 Nodara · Software libre</p>
      </footer>
    </div>
  );
}
