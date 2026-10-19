"use client";

import { Modal } from "./modal";

const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: "General",
    items: [
      ["Ctrl + K", "Buscar páginas"],
      ["Ctrl + \\", "Mostrar u ocultar la barra lateral"],
      ["Ctrl + /", "Ver esta lista de atajos"],
      ["Ctrl + D", "Duplicar la página abierta"],
      ["Ctrl + Mayús + R", "Renombrar la página"],
      ["Ctrl + Mayús + P", "Mover la página a…"],
    ],
  },
  {
    title: "Editor",
    items: [
      ["/", "Menú de bloques (callout, imagen, columnas, ecuación…)"],
      ["@", "Mencionar a una persona"],
      ["$x^2$", "Ecuación en línea"],
      ["Ctrl + B / I / U", "Negrita, cursiva, subrayado"],
      ["Ctrl + Mayús + S", "Tachado"],
      ["Ctrl + E", "Código en línea"],
      ["Ctrl + Z / Ctrl + Mayús + Z", "Deshacer y rehacer"],
      ["# + espacio", "Encabezado (## y ### para niveles menores)"],
      ["- + espacio", "Lista con viñetas"],
      ["1. + espacio", "Lista numerada"],
      ["[] + espacio", "Lista de tareas"],
      ["> + espacio", "Cita"],
      ["``` + espacio", "Bloque de código"],
      ["---", "Divisor"],
    ],
  },
];

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal label="Atajos de teclado" testId="shortcuts-dialog" onClose={onClose} width={560}>
      <h2 className="mb-3 text-[18px] font-semibold">Atajos de teclado</h2>
      {GROUPS.map((g) => (
        <section key={g.title} className="mb-3">
          <h3 className="mb-1 text-[12px] font-medium text-ink-3">{g.title}</h3>
          <dl>
            {g.items.map(([keys, what]) => (
              <div key={keys} className="flex items-center justify-between gap-4 border-b border-line py-1.5 last:border-0">
                <dt className="text-ink-2">{what}</dt>
                <dd>
                  <kbd className="whitespace-nowrap rounded border border-line bg-hover px-1.5 py-0.5 font-mono text-[12px]">{keys}</kbd>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </Modal>
  );
}
