/**
 * Ilustraciones de la portada hechas con HTML y los tokens del tema (sin capturas ni imágenes): una ventana de Nodara
 * con barra lateral, documento y tablero. Decorativas: se ocultan a los lectores de pantalla.
 */

const Line = ({ w, strong = false }: { w: string; strong?: boolean }) => <span className={`block h-2 rounded-full ${strong ? "bg-[var(--landing-line-strong)]" : "bg-[var(--landing-line)]"}`} style={{ width: w }} />;

function Window({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--landing-border)] bg-[var(--bg)] shadow-[var(--landing-shadow)]" aria-hidden>
      <div className="flex h-9 items-center gap-1.5 border-b border-[var(--landing-border)] bg-[var(--bg-sidebar)] px-3">
        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
        <span className="size-2.5 rounded-full bg-[#febc2e]" />
        <span className="size-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 truncate text-[12px] text-ink-3">{title}</span>
      </div>
      {children}
    </div>
  );
}

const SIDEBAR = [
  { icon: "🏠", label: "Inicio" },
  { icon: "📘", label: "Manual del equipo", active: true },
  { icon: "🗂️", label: "Proyectos" },
  { icon: "🗓️", label: "Reuniones" },
  { icon: "💡", label: "Ideas" },
  { icon: "📚", label: "Lecturas" },
];

const BOARD = [
  { name: "Por hacer", color: "#e3e2e0", dark: "#373737", cards: ["Guion del vídeo", "Encuesta a usuarios"] },
  { name: "En curso", color: "#d3e5ef", dark: "#28456c", cards: ["Rediseño de portada", "Plan del trimestre"] },
  { name: "Hecho", color: "#dbeddb", dark: "#2b593f", cards: ["Lanzamiento beta"] },
];

export function ProductMock() {
  return (
    <Window title="Manual del equipo — Nodara">
      <div className="flex min-h-[340px] text-left sm:min-h-[420px]">
        <div className="hidden w-[200px] shrink-0 flex-col gap-0.5 border-r border-[var(--landing-border)] bg-[var(--bg-sidebar)] p-2 sm:flex">
          <div className="mb-2 flex items-center gap-2 px-2 py-1 text-[13px] font-semibold">
            <span className="flex size-5 items-center justify-center rounded bg-[var(--brand-violet)] text-[11px] text-white">N</span>
            Espacio de Lucía
          </div>
          {SIDEBAR.map((s) => (
            <div key={s.label} className={`flex items-center gap-2 rounded-md px-2 py-1 text-[13px] ${s.active ? "bg-[var(--bg-active)] font-medium" : "text-ink-2"}`}>
              <span>{s.icon}</span>
              {s.label}
            </div>
          ))}
        </div>
        <div className="min-w-0 flex-1 px-5 py-6 sm:px-10">
          <div className="mb-2 text-[34px] leading-none">📘</div>
          <div className="mb-4 text-[24px] font-bold sm:text-[28px]">Manual del equipo</div>
          <div className="mb-5 flex flex-col gap-2">
            <Line w="92%" />
            <Line w="78%" />
          </div>
          <div className="mb-3 flex items-start gap-3 rounded-lg bg-[var(--callout-gray)] p-3">
            <span>💡</span>
            <div className="flex flex-1 flex-col gap-2 pt-1">
              <Line w="85%" strong />
              <Line w="60%" />
            </div>
          </div>
          <div className="mb-5 flex flex-col gap-2">
            {["Revisar objetivos de la semana", "Publicar notas de la reunión"].map((x, i) => (
              <div key={x} className="flex items-center gap-2 text-[13px]">
                <span className={`flex size-3.5 items-center justify-center rounded-[3px] border ${i === 0 ? "border-[var(--accent)] bg-[var(--accent)] text-[9px] text-white" : "border-[var(--landing-line-strong)]"}`}>{i === 0 ? "✓" : ""}</span>
                <span className={i === 0 ? "text-ink-3 line-through" : ""}>{x}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {BOARD.map((col) => (
              <div key={col.name} className="min-w-0">
                <span className="nd-landing-tag mb-2 inline-block rounded px-1.5 text-[11px] font-medium" style={{ "--tag-light": col.color, "--tag-dark": col.dark } as React.CSSProperties}>
                  {col.name}
                </span>
                <div className="flex flex-col gap-1.5">
                  {col.cards.map((c) => (
                    <div key={c} className="truncate rounded-md border border-[var(--landing-border)] bg-[var(--popover)] px-2 py-1.5 text-[12px] shadow-[var(--home-shadow-sm)]">
                      {c}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Window>
  );
}

/** Ilustraciones pequeñas para cada pestaña de funciones. */
export function TabMock({ kind }: { kind: "docs" | "wiki" | "projects" | "databases" }) {
  if (kind === "docs")
    return (
      <Window title="Propuesta de proyecto">
        <div className="flex flex-col gap-3 p-6 text-left">
          <div className="text-[22px] font-bold">Propuesta de proyecto</div>
          <div className="text-[15px] font-semibold">1. Contexto</div>
          <Line w="95%" />
          <Line w="82%" />
          <div className="rounded-md bg-[var(--pre-bg)] p-3 font-mono text-[12px] text-ink-2">const objetivo = &quot;lanzar en marzo&quot;;</div>
          <div className="text-[15px] font-semibold">2. Alcance</div>
          <div className="flex items-center gap-2 text-[13px]"><span className="text-ink-3">•</span>Editor por bloques con menú «/»</div>
          <div className="flex items-center gap-2 text-[13px]"><span className="text-ink-3">•</span>Ecuaciones: <span className="font-serif italic">E = mc²</span></div>
          <div className="mt-1 inline-flex w-fit items-center gap-2 rounded-full bg-[var(--home-chip)] px-2.5 py-1 text-[12px] text-[var(--brand-link)]">💬 2 comentarios · Ana y Marcos</div>
        </div>
      </Window>
    );
  if (kind === "wiki")
    return (
      <Window title="Wiki de la empresa">
        <div className="grid grid-cols-2 gap-3 p-6 text-left">
          {[
            ["🧭", "Cómo trabajamos"],
            ["🛠️", "Herramientas"],
            ["👋", "Bienvenida"],
            ["🔐", "Seguridad"],
          ].map(([i, l]) => (
            <div key={l} className="rounded-lg border border-[var(--landing-border)] p-3">
              <div className="mb-2 text-[22px]">{i}</div>
              <div className="mb-2 text-[14px] font-semibold">{l}</div>
              <Line w="80%" />
            </div>
          ))}
        </div>
      </Window>
    );
  if (kind === "projects")
    return (
      <Window title="Hoja de ruta">
        <div className="flex flex-col gap-2 p-6 text-left">
          {[
            ["Investigación", "8%", "30%"],
            ["Diseño", "28%", "34%"],
            ["Desarrollo", "45%", "40%"],
            ["Lanzamiento", "78%", "18%"],
          ].map(([name, left, width]) => (
            <div key={name} className="flex items-center gap-3 text-[13px]">
              <span className="w-24 shrink-0 text-ink-2">{name}</span>
              <span className="relative h-6 flex-1 rounded bg-[var(--landing-track)]">
                <span className="absolute inset-y-0 rounded bg-[var(--brand-violet)]" style={{ left, width }} />
              </span>
            </div>
          ))}
        </div>
      </Window>
    );
  return (
    <Window title="Tareas">
      <table className="w-full text-left text-[13px]">
        <thead className="text-[12px] text-[var(--db-header)]">
          <tr className="border-b border-[var(--landing-border)]">
            <th className="px-4 py-2 font-medium">Nombre</th>
            <th className="px-4 py-2 font-medium">Estado</th>
            <th className="hidden px-4 py-2 font-medium sm:table-cell">Fecha</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["Preparar demo", "En curso", "12 nov"],
            ["Revisar contrato", "Por hacer", "15 nov"],
            ["Enviar factura", "Hecho", "3 nov"],
            ["Entrevista", "En curso", "20 nov"],
          ].map(([n, s, d]) => (
            <tr key={n} className="border-b border-[var(--landing-border)]">
              <td className="px-4 py-2">{n}</td>
              <td className="px-4 py-2">
                <span className="rounded bg-[var(--bg-active)] px-1.5 py-0.5 text-[12px]">{s}</span>
              </td>
              <td className="hidden px-4 py-2 text-ink-2 sm:table-cell">{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Window>
  );
}
