"use client";

import { BookOpen, Database, FileText, KanbanSquare } from "lucide-react";
import { useState } from "react";
import { TabMock } from "./product-mock";

const TABS = [
  { id: "docs", icon: FileText, label: "Documentos", title: "Escribe sin fricción", body: "Bloques que se mueven con el ratón, menú «/» para insertar cualquier cosa, código con resaltado, ecuaciones, llamadas y columnas. Comenta sobre el texto y menciona a tu equipo." },
  { id: "wiki", icon: BookOpen, label: "Wikis", title: "Todo el conocimiento en un sitio", body: "Páginas anidadas sin límite, favoritos, búsqueda en todo el espacio y enlaces públicos de solo lectura para compartir fuera del equipo." },
  { id: "projects", icon: KanbanSquare, label: "Proyectos", title: "Planifica y sigue el trabajo", body: "Tableros, calendarios y cronogramas sobre los mismos datos. Asigna personas, fechas y estados y mira el avance de un vistazo." },
  { id: "databases", icon: Database, label: "Bases de datos", title: "Datos con superpoderes", body: "Seis vistas, filtros AND/OR, ordenación, agrupación, relaciones, rollups y fórmulas. Importa CSV y exporta cuando quieras." },
] as const;

/** Pestañas de funciones de la portada (patrón de pestañas WAI-ARIA con flechas). */
export function FeatureTabs() {
  const [active, setActive] = useState(0);
  const tab = TABS[active];
  const onKey = (e: React.KeyboardEvent) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = (active + d + TABS.length) % TABS.length;
    setActive(next);
    document.getElementById(`landing-tab-${TABS[next].id}`)?.focus();
  };
  return (
    <div className="flex flex-col gap-8">
      <div role="tablist" aria-label="Funciones de Nodara" className="mx-auto flex max-w-full flex-wrap justify-center gap-2" onKeyDown={onKey}>
        {TABS.map((x, i) => {
          const Icon = x.icon;
          const selected = i === active;
          return (
            <button
              key={x.id}
              id={`landing-tab-${x.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="landing-tabpanel"
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(i)}
              className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[15px] font-medium transition-colors ${selected ? "border-transparent bg-[var(--text)] text-[var(--bg)]" : "border-[var(--landing-border)] text-ink-2 hover:bg-hover hover:text-ink"}`}
            >
              <Icon size={16} aria-hidden />
              {x.label}
            </button>
          );
        })}
      </div>
      <div id="landing-tabpanel" role="tabpanel" aria-labelledby={`landing-tab-${tab.id}`} className="grid items-center gap-8 md:grid-cols-[1fr_1.4fr]" data-testid="landing-tabpanel">
        <div className="flex flex-col gap-3 text-left">
          <h3 className="text-[28px] font-bold leading-tight tracking-[-0.01em]">{tab.title}</h3>
          <p className="text-[17px] text-ink-2">{tab.body}</p>
        </div>
        <TabMock kind={tab.id} />
      </div>
    </div>
  );
}
