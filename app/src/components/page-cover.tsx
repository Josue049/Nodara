"use client";

import { ImagePlus } from "lucide-react";
import { useRef, useState } from "react";
import { anchorOf, Popover, type Anchor } from "./database/popover";
import { IMAGE_TYPES, uploadFile } from "./editor/upload";
import { safeUrl } from "./editor/blocks";

/** Portadas predefinidas: colores y degradados propios de Nodara. */
export const COVER_PRESETS: { id: string; label: string; css: string }[] = [
  { id: "color:gris", label: "Gris", css: "#e3e2e0" },
  { id: "color:marron", label: "Marrón", css: "#eee0da" },
  { id: "color:naranja", label: "Naranja", css: "#fadec9" },
  { id: "color:amarillo", label: "Amarillo", css: "#fdecc8" },
  { id: "color:verde", label: "Verde", css: "#dbeddb" },
  { id: "color:azul", label: "Azul", css: "#d3e5ef" },
  { id: "color:morado", label: "Morado", css: "#e8deee" },
  { id: "color:rosa", label: "Rosa", css: "#f5e0e9" },
  { id: "gradient:atardecer", label: "Atardecer", css: "linear-gradient(135deg,#f6d365,#fda085)" },
  { id: "gradient:oceano", label: "Océano", css: "linear-gradient(135deg,#84fab0,#8fd3f4)" },
  { id: "gradient:lavanda", label: "Lavanda", css: "linear-gradient(135deg,#a18cd1,#fbc2eb)" },
  { id: "gradient:aurora", label: "Aurora", css: "linear-gradient(135deg,#43e97b,#38f9d7)" },
  { id: "gradient:noche", label: "Noche", css: "linear-gradient(135deg,#0f2027,#2c5364)" },
  { id: "gradient:cereza", label: "Cereza", css: "linear-gradient(135deg,#eb3349,#f45c43)" },
];

/** Estilo CSS de fondo de una portada, o null si el valor no es válido (nunca se inyecta texto arbitrario en CSS). */
export function coverStyle(cover: string | null): React.CSSProperties | null {
  if (!cover) return null;
  const preset = COVER_PRESETS.find((p) => p.id === cover);
  if (preset) return { background: preset.css };
  const url = safeUrl(cover);
  return url ? { backgroundImage: `url("${url.replace(/["\\\n]/g, "")}")`, backgroundSize: "cover", backgroundPosition: "center" } : null;
}

/** Banda de portada con acciones de cambio y quitado (solo con permiso de edición). */
export function PageCover({ cover, canEdit, onChange }: { cover: string | null; canEdit: boolean; onChange: (cover: string | null) => void }) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const style = coverStyle(cover);
  if (!style) return null;
  return (
    <div className="group/cover relative h-[30vh] min-h-[160px] w-full" style={style} data-testid="page-cover" role="img" aria-label="Portada de la página">
      {canEdit && (
        <div className="absolute bottom-2 right-4 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/cover:opacity-100 max-[900px]:opacity-100">
          <button ref={btn} type="button" data-testid="change-cover" onClick={() => btn.current && setAnchor(anchorOf(btn.current))} className="h-7 rounded-md bg-[var(--popover)]/90 px-2 text-[13px] shadow-[var(--shadow-pop)] hover:bg-[var(--popover)]">
            Cambiar portada
          </button>
          <button type="button" data-testid="remove-cover" onClick={() => onChange(null)} className="h-7 rounded-md bg-[var(--popover)]/90 px-2 text-[13px] shadow-[var(--shadow-pop)] hover:bg-[var(--popover)]">
            Quitar
          </button>
        </div>
      )}
      {anchor && <CoverPicker anchor={anchor} onClose={() => setAnchor(null)} onPick={(c) => (onChange(c), setAnchor(null))} />}
    </div>
  );
}

/** Botón «Añadir portada» (aparece al pasar sobre el título cuando no hay portada). */
export function AddCoverButton({ onChange }: { onChange: (cover: string) => void }) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={btn}
        type="button"
        data-testid="add-cover"
        onClick={() => btn.current && setAnchor(anchorOf(btn.current))}
        className="mb-1 flex items-center gap-1.5 rounded-md px-2 py-1 text-[14px] text-ink-3 opacity-0 hover:bg-hover focus-visible:opacity-100 group-hover/icon:opacity-100 max-[900px]:opacity-100"
      >
        <ImagePlus size={16} /> Añadir portada
      </button>
      {anchor && <CoverPicker anchor={anchor} onClose={() => setAnchor(null)} onPick={(c) => (onChange(c), setAnchor(null))} />}
    </>
  );
}

function CoverPicker({ anchor, onClose, onPick }: { anchor: Anchor; onClose: () => void; onPick: (cover: string) => void }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <Popover anchor={anchor} onClose={onClose} label="Elegir portada" testId="cover-picker" width={340}>
      <div className="p-2">
        <p className="pb-1 text-[12px] font-medium text-ink-3">Colores y degradados</p>
        <div className="grid grid-cols-7 gap-1.5">
          {COVER_PRESETS.map((p) => (
            <button key={p.id} type="button" aria-label={`Portada ${p.label}`} title={p.label} data-testid={`cover-${p.id}`} onClick={() => onPick(p.id)} className="h-8 rounded-md border border-line hover:brightness-95" style={{ background: p.css }} />
          ))}
        </div>
        <p className="pb-1 pt-3 text-[12px] font-medium text-ink-3">Imagen</p>
        <input
          ref={input}
          type="file"
          hidden
          accept={IMAGE_TYPES.join(",")}
          data-testid="cover-file-input"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true);
            setError("");
            try {
              onPick((await uploadFile(f)).url);
            } catch (err) {
              setError(err instanceof Error ? err.message : "No se pudo subir la imagen");
              setBusy(false);
            }
          }}
        />
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className="mb-2 h-8 w-full rounded-md border border-line hover:bg-hover disabled:opacity-60">
          {busy ? "Subiendo…" : "Subir una imagen"}
        </button>
        <form
          className="flex gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            const v = url.trim();
            if (!v) return;
            if (!safeUrl(v)) return setError("Solo se admiten enlaces http(s)");
            onPick(v);
          }}
        >
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="o pega el enlace de una imagen" aria-label="Enlace de la portada" className="h-8 min-w-0 flex-1 rounded-md border border-line bg-transparent px-2 outline-none focus:border-accent" />
          <button type="submit" className="h-8 rounded-md bg-accent px-2 text-white">
            Usar
          </button>
        </form>
        {error && (
          <p role="alert" className="pt-1 text-[13px] text-danger">
            {error}
          </p>
        )}
      </div>
    </Popover>
  );
}
