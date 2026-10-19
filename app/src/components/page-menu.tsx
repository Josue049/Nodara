"use client";

import { BarChart3, Download, History, LayoutTemplate, Lock, LockOpen, Printer, Type } from "lucide-react";
import { useState } from "react";
import { call } from "./database/api";
import { MenuRow } from "./database/popover";

export type PageSettings = { fontStyle: "sans" | "serif" | "mono"; smallText: boolean; fullWidth: boolean; locked: boolean };

const FONTS: { id: PageSettings["fontStyle"]; label: string; sample: string; family: string }[] = [
  { id: "sans", label: "Predeterminada", sample: "Ag", family: "var(--font-sans)" },
  { id: "serif", label: "Serif", sample: "Ag", family: "ui-serif, Georgia, 'Times New Roman', serif" },
  { id: "mono", label: "Monoespaciada", sample: "Ag", family: "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace" },
];

function Toggle({ on, onClick, label, testId, icon, disabled }: { on: boolean; onClick: () => void; label: string; testId: string; icon?: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      data-testid={testId}
      onClick={onClick}
      className="flex h-[30px] w-full items-center gap-2 rounded-md px-2 text-left hover:bg-hover disabled:opacity-50"
    >
      {icon && <span className="flex w-5 shrink-0 justify-center text-ink-2">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "bg-active"}`}>
        <span className={`absolute top-0.5 size-3 rounded-full bg-white transition-all ${on ? "left-[14px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

/** Contenido del menú «⋯» de una página: estilo, bloqueo, exportación, plantilla, analíticas e historial. */
export function PageMenu({
  pageId,
  title,
  settings,
  canEdit,
  canUnlock,
  isDatabase,
  collectionId,
  onSettings,
  onHistory,
  onAnalytics,
  onClose,
}: {
  pageId: string;
  title: string;
  settings: PageSettings;
  canEdit: boolean;
  canUnlock: boolean;
  isDatabase: boolean;
  collectionId?: string | null;
  onSettings: (patch: Partial<PageSettings>) => void;
  onHistory: () => void;
  onAnalytics: () => void;
  onClose: () => void;
}) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState(title);
  const [message, setMessage] = useState("");
  const link = (format: string, label: string, href = `/api/pages/${pageId}/export?format=${format}`) => (
    <a key={format} href={href} download onClick={onClose} data-testid={`export-${format}`} className="flex h-[30px] items-center gap-2 rounded-md px-2 pl-9 hover:bg-hover">
      {label}
    </a>
  );
  return (
    <div data-testid="page-menu">
      {!isDatabase && (
        <>
          <p className="px-2 pb-1 pt-1.5 text-[12px] font-medium text-ink-3">Estilo</p>
          <div className="grid grid-cols-3 gap-1 px-1 pb-1" role="radiogroup" aria-label="Tipografía de la página">
            {FONTS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={settings.fontStyle === f.id}
                data-testid={`font-${f.id}`}
                disabled={!canEdit}
                onClick={() => onSettings({ fontStyle: f.id })}
                className={`flex flex-col items-center rounded-md border px-1 py-1.5 hover:bg-hover disabled:opacity-50 ${settings.fontStyle === f.id ? "border-accent" : "border-transparent"}`}
              >
                <span className="text-[20px] leading-none" style={{ fontFamily: f.family }}>
                  {f.sample}
                </span>
                <span className="mt-1 text-[11px] text-ink-2">{f.label}</span>
              </button>
            ))}
          </div>
          <Toggle on={settings.smallText} onClick={() => onSettings({ smallText: !settings.smallText })} label="Texto pequeño" testId="toggle-small" icon={<Type size={16} />} disabled={!canEdit} />
          <Toggle on={settings.fullWidth} onClick={() => onSettings({ fullWidth: !settings.fullWidth })} label="Ancho completo" testId="toggle-wide" icon={<span className="text-[13px]">↔</span>} disabled={!canEdit} />
        </>
      )}
      <Toggle
        on={settings.locked}
        onClick={() => onSettings({ locked: !settings.locked })}
        label="Bloquear página"
        testId="toggle-lock"
        icon={settings.locked ? <Lock size={16} /> : <LockOpen size={16} />}
        disabled={!canUnlock}
      />
      <div className="my-1 border-t border-line" />
      <p className="flex items-center gap-2 px-2 py-1.5 text-ink-2">
        <Download size={16} /> Exportar
      </p>
      {isDatabase && collectionId ? link("csv", "CSV", `/api/databases/${collectionId}/export`) : [link("md", "Markdown"), link("html", "HTML"), link("json", "JSON de Nodara")]}
      <MenuRow
        icon={<Printer size={16} />}
        testId="print-page"
        onClick={() => {
          onClose();
          setTimeout(() => window.print(), 50);
        }}
      >
        Imprimir o guardar como PDF
      </MenuRow>
      <div className="my-1 border-t border-line" />
      {!isDatabase &&
        (naming ? (
          <form
            className="flex gap-1 px-1 py-1"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!name.trim()) return;
              try {
                await call("/api/page-templates", "POST", { pageId, name: name.trim() });
                setMessage("Plantilla guardada");
                setNaming(false);
              } catch (err) {
                setMessage(err instanceof Error ? err.message : "No se pudo guardar");
              }
            }}
          >
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-label="Nombre de la plantilla" className="h-8 min-w-0 flex-1 rounded-md border border-line bg-transparent px-2 outline-none focus:border-accent" />
            <button type="submit" data-testid="save-template-confirm" className="h-8 rounded-md bg-accent px-2 text-white">
              Guardar
            </button>
          </form>
        ) : (
          <MenuRow icon={<LayoutTemplate size={16} />} testId="save-template" onClick={() => setNaming(true)}>
            Guardar como plantilla
          </MenuRow>
        ))}
      {message && (
        <p role="status" data-testid="page-menu-message" className="px-2 py-1 text-[13px] text-ink-2">
          {message}
        </p>
      )}
      {canEdit && (
        <MenuRow icon={<BarChart3 size={16} />} testId="open-analytics" onClick={onAnalytics}>
          Analíticas de la página
        </MenuRow>
      )}
      <MenuRow icon={<History size={16} />} onClick={onHistory} testId="open-history">
        Historial de versiones
      </MenuRow>
    </div>
  );
}
