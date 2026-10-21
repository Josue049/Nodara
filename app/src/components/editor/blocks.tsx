"use client";

import { Extension, InputRule } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import katex from "katex";
import "katex/dist/katex.min.css";
import { common, createLowlight } from "lowlight";
import { AlignCenter, AlignLeft, AlignRight, Check, Copy, Download, ExternalLink, FileText, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AudioBlockBase,
  BookmarkBase,
  BreadcrumbBase,
  CALLOUT_COLORS,
  CalloutBase,
  FileBlockBase,
  ImageBlockBase,
  MathBlockBase,
  MathInlineBase,
  PageLinkBase,
  TocBase,
  VideoBlockBase,
} from "@/lib/editor/schema";
import { pathTo } from "@/lib/tree";
import { EmojiPicker } from "../emoji-picker";
import { PageIcon } from "../page-icon";
import { useOptionalWorkspace } from "../workspace-provider";
import { getPageId } from "./database-node";
import { AUDIO_TYPES, IMAGE_TYPES, uploadFile, VIDEO_TYPES } from "./upload";

/** Renderiza LaTeX con KaTeX sin ejecutar HTML del usuario (`trust: false`); los errores se muestran, no se lanzan. */
export function renderLatex(latex: string, display: boolean): { html: string; error: boolean } {
  try {
    return { html: katex.renderToString(latex, { displayMode: display, throwOnError: true, trust: false, output: "htmlAndMathml" }), error: false };
  } catch {
    return { html: "", error: true };
  }
}

const formatSize = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`);

/** Solo se aceptan rutas internas de archivos o URLs http(s)/data de imagen: nunca `javascript:`. */
export const safeUrl = (u: string) => (/^(https?:\/\/|\/api\/files\/)/i.test(u) ? u : "");


/** Estado vacío de un bloque de medios: subir un archivo o pegar un enlace. */
function MediaPicker({ kind, onFile, onUrl, onCancel }: { kind: "image" | "file" | "bookmark" | "video" | "audio"; onFile?: (f: { name: string; url: string; size: number }) => void; onUrl: (u: string) => void; onCancel: () => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const label = { image: "imagen", file: "archivo", bookmark: "marcador", video: "vídeo", audio: "audio" }[kind];
  const submitUrl = () => {
    const v = url.trim();
    if (!v) return;
    const full = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
    if (!safeUrl(full)) return setError("Solo se admiten enlaces http(s)");
    onUrl(full);
  };
  return (
    <div className="nd-media-picker rounded-md bg-hover p-3" data-testid={`${kind}-picker`}>
      <div className="flex flex-wrap items-center gap-2">
        {onFile && (
          <>
            <input
              ref={input}
              type="file"
              hidden
              data-testid={`${kind}-file-input`}
              accept={kind === "image" ? IMAGE_TYPES.join(",") : kind === "video" ? VIDEO_TYPES.join(",") : kind === "audio" ? AUDIO_TYPES.join(",") : undefined}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setBusy(true);
                setError("");
                try {
                  onFile(await uploadFile(f));
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Error al subir");
                } finally {
                  setBusy(false);
                }
              }}
            />
            <button type="button" disabled={busy} onClick={() => input.current?.click()} className="h-8 rounded-md border border-line px-3 hover:bg-active">
              {busy ? "Subiendo…" : `Subir ${label}`}
            </button>
          </>
        )}
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitUrl();
            }
            e.stopPropagation();
          }}
          placeholder={`Pega el enlace ${kind === "bookmark" ? "de la página" : kind === "video" || kind === "audio" ? `del ${label}` : `de la ${label}`}…`}
          aria-label={`Enlace de ${label}`}
          className="h-8 min-w-[180px] flex-1 rounded-md border border-line bg-transparent px-2 outline-none focus:border-accent"
        />
        <button type="button" onClick={submitUrl} disabled={!url.trim()} className="h-8 rounded-md bg-accent px-3 text-white disabled:opacity-50">
          Insertar
        </button>
        <button type="button" onClick={onCancel} className="h-8 rounded-md px-2 hover:bg-active">
          Quitar
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-[13px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

// ── Callout ──
function CalloutView({ node, updateAttributes, editor }: NodeViewProps) {
  const [picker, setPicker] = useState(false);
  const color = String(node.attrs.color);
  return (
    <NodeViewWrapper className="nd-callout" data-type="callout" data-color={color} data-testid="callout">
      <div className="relative" contentEditable={false}>
        <button
          type="button"
          className="nd-callout-icon"
          aria-label="Cambiar icono"
          data-testid="callout-icon"
          disabled={!editor.isEditable}
          onClick={() => setPicker((o) => !o)}
        >
          {String(node.attrs.icon)}
        </button>
        {picker && (
          <div className="absolute left-0 top-9 z-40">
            <EmojiPicker
              onClose={() => setPicker(false)}
              onPick={(e) => {
                updateAttributes({ icon: e ?? "💡" });
                setPicker(false);
              }}
            />
          </div>
        )}
      </div>
      <NodeViewContent className="nd-callout-body" />
      {editor.isEditable && (
        <div className="nd-callout-colors" contentEditable={false}>
          {CALLOUT_COLORS.map((c) => (
            <button key={c} type="button" aria-label={`Color ${c}`} data-color={c} aria-pressed={c === color} onClick={() => updateAttributes({ color: c })} className="nd-callout-swatch" />
          ))}
        </div>
      )}
    </NodeViewWrapper>
  );
}
export const Callout = CalloutBase.extend({ addNodeView: () => ReactNodeViewRenderer(CalloutView) });

// ── Imagen ──
function ImageView({ node, updateAttributes, deleteNode, editor, selected }: NodeViewProps) {
  const a = node.attrs as { src: string; alt: string; caption: string; width: number; align: string };
  const wrap = useRef<HTMLDivElement>(null);
  const [broken, setBroken] = useState(false);
  const src = safeUrl(a.src);
  if (!a.src && editor.isEditable)
    return (
      <NodeViewWrapper contentEditable={false} data-testid="image-block">
        <MediaPicker kind="image" onFile={(f) => updateAttributes({ src: f.url, alt: f.name })} onUrl={(u) => updateAttributes({ src: u })} onCancel={deleteNode} />
      </NodeViewWrapper>
    );
  const startResize = (e: React.PointerEvent, dir: 1 | -1) => {
    e.preventDefault();
    const box = wrap.current?.parentElement;
    if (!box) return;
    const full = box.getBoundingClientRect().width;
    const startX = e.clientX;
    const startW = a.width;
    const move = (ev: PointerEvent) => updateAttributes({ width: Math.max(10, Math.min(100, Math.round(startW + (dir * (ev.clientX - startX) * 100) / full))) });
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const justify = a.align === "left" ? "flex-start" : a.align === "right" ? "flex-end" : "center";
  return (
    <NodeViewWrapper className="nd-image-view group/img" data-testid="image-block" contentEditable={false}>
      <div style={{ display: "flex", justifyContent: justify }}>
        <div ref={wrap} className="relative max-w-full" style={{ width: `${a.width}%` }}>
          {src && !broken ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={a.alt} onError={() => setBroken(true)} className={`block w-full rounded-[4px] ${selected ? "outline outline-2 outline-accent" : ""}`} draggable={false} />
          ) : (
            <div className="flex h-24 items-center justify-center rounded-[4px] bg-hover text-ink-3" role="img" aria-label="Imagen no disponible">
              Imagen no disponible
            </div>
          )}
          {editor.isEditable && (
            <>
              <span onPointerDown={(e) => startResize(e, -1)} className="nd-resize left-1" data-testid="image-resize-left" aria-hidden />
              <span onPointerDown={(e) => startResize(e, 1)} className="nd-resize right-1" data-testid="image-resize-right" aria-hidden />
              <div className="absolute right-2 top-2 flex gap-0.5 rounded-md bg-[var(--popover)] p-0.5 opacity-0 shadow-[var(--shadow-pop)] group-hover/img:opacity-100 focus-within:opacity-100">
                {([["left", AlignLeft, "Alinear a la izquierda"], ["center", AlignCenter, "Centrar"], ["right", AlignRight, "Alinear a la derecha"]] as const).map(([v, Icon, label]) => (
                  <button key={v} type="button" aria-label={label} aria-pressed={a.align === v} onClick={() => updateAttributes({ align: v })} className={`rounded p-1 hover:bg-hover ${a.align === v ? "bg-active" : ""}`}>
                    <Icon size={14} />
                  </button>
                ))}
                <button type="button" aria-label="Eliminar imagen" data-testid="image-delete" onClick={deleteNode} className="rounded p-1 hover:bg-hover">
                  <Trash2 size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {editor.isEditable ? (
        <input
          value={a.caption}
          onChange={(e) => updateAttributes({ caption: e.target.value })}
          placeholder="Añade un pie de foto"
          aria-label="Pie de foto"
          className="mx-auto mt-1 block w-full bg-transparent text-center text-[14px] text-ink-2 outline-none placeholder:text-transparent group-hover/img:placeholder:text-ink-3 focus:placeholder:text-ink-3"
        />
      ) : (
        a.caption && <p className="mt-1 text-center text-[14px] text-ink-2">{a.caption}</p>
      )}
    </NodeViewWrapper>
  );
}
export const ImageBlock = ImageBlockBase.extend({ addNodeView: () => ReactNodeViewRenderer(ImageView) });

// ── Vídeo y audio ──
function MediaView({ node, updateAttributes, deleteNode, editor, kind }: NodeViewProps & { kind: "video" | "audio" }) {
  const a = node.attrs as { src: string; caption: string };
  const src = safeUrl(a.src);
  const testId = `${kind}-block`;
  if (!a.src && editor.isEditable)
    return (
      <NodeViewWrapper contentEditable={false} data-testid={testId}>
        <MediaPicker kind={kind} onFile={(f) => updateAttributes({ src: f.url })} onUrl={(u) => updateAttributes({ src: u })} onCancel={deleteNode} />
      </NodeViewWrapper>
    );
  return (
    <NodeViewWrapper className="nd-media-view group/media" data-testid={testId} contentEditable={false}>
      {src ? (
        kind === "video" ? (
          <video src={src} controls preload="metadata" className="block w-full rounded-[4px] bg-black" />
        ) : (
          <audio src={src} controls preload="metadata" className="block w-full" />
        )
      ) : (
        <div className="flex h-16 items-center justify-center rounded-[4px] bg-hover text-ink-3">{kind === "video" ? "Vídeo no disponible" : "Audio no disponible"}</div>
      )}
      {editor.isEditable ? (
        <input
          value={a.caption}
          onChange={(e) => updateAttributes({ caption: e.target.value })}
          placeholder="Añade un pie"
          aria-label={`Pie del ${kind === "video" ? "vídeo" : "audio"}`}
          className="mt-1 block w-full bg-transparent text-[14px] text-ink-2 outline-none placeholder:text-transparent group-hover/media:placeholder:text-ink-3 focus:placeholder:text-ink-3"
        />
      ) : (
        a.caption && <p className="mt-1 text-[14px] text-ink-2">{a.caption}</p>
      )}
    </NodeViewWrapper>
  );
}
const VideoView = (p: NodeViewProps) => <MediaView {...p} kind="video" />;
const AudioView = (p: NodeViewProps) => <MediaView {...p} kind="audio" />;
export const VideoBlock = VideoBlockBase.extend({ addNodeView: () => ReactNodeViewRenderer(VideoView) });
export const AudioBlock = AudioBlockBase.extend({ addNodeView: () => ReactNodeViewRenderer(AudioView) });

// ── Página / enlace a página ──
function PageLinkView({ node, updateAttributes, deleteNode, editor }: NodeViewProps) {
  const ws = useOptionalWorkspace();
  const a = node.attrs as { pageId: string; title: string; icon: string | null };
  const live = ws?.pages.find((p) => p.id === a.pageId);
  const title = live?.title ?? a.title;
  const icon = live ? live.icon : a.icon;
  // Mantiene la copia del título (exportación, búsqueda y vistas públicas) al día con la página enlazada.
  useEffect(() => {
    if (live && editor.isEditable && (live.title !== a.title || live.icon !== a.icon)) updateAttributes({ title: live.title, icon: live.icon });
  }, [live, a.title, a.icon, editor, updateAttributes]);
  if (!a.pageId) {
    if (!editor.isEditable || !ws) return <NodeViewWrapper />;
    return (
      <NodeViewWrapper contentEditable={false} data-testid="page-link-picker">
        <PagePicker exclude={getPageId(editor)} onPick={(p) => updateAttributes({ pageId: p.id, title: p.title, icon: p.icon })} onCancel={deleteNode} />
      </NodeViewWrapper>
    );
  }
  const body = (
    <>
      <span className="flex size-[22px] shrink-0 items-center justify-center">
        <PageIcon icon={icon} kind={live?.kind} size={19} />
      </span>
      <span className="nd-page-link-title truncate">{title || "Sin título"}</span>
    </>
  );
  return (
    <NodeViewWrapper className="nd-page-link" data-testid="page-link" contentEditable={false}>
      {ws && live ? (
        <Link href={`/${a.pageId}`} className="flex min-w-0 items-center gap-1.5 rounded-[4px] px-0.5 py-[3px] hover:bg-hover" draggable={false}>
          {body}
        </Link>
      ) : (
        <span className="flex min-w-0 items-center gap-1.5 px-0.5 py-[3px] text-ink-2">{body}</span>
      )}
    </NodeViewWrapper>
  );
}

const normText = (v: string) => v.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Buscador de páginas del espacio para «Enlace a página». */
function PagePicker({ exclude, onPick, onCancel }: { exclude: string | null; onPick: (p: { id: string; title: string; icon: string | null }) => void; onCancel: () => void }) {
  const ws = useOptionalWorkspace();
  const [q, setQ] = useState("");
  const [index, setIndex] = useState(0);
  const matches = (ws?.pages ?? []).filter((p) => p.id !== exclude && normText(p.title || "Sin título").includes(normText(q.trim()))).slice(0, 8);
  return (
    <div className="nd-menu w-[324px] max-w-full overflow-hidden" role="dialog" aria-label="Enlazar con una página">
      <div className="p-2">
        <input
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + matches.length) % Math.max(1, matches.length));
            } else if (e.key === "Enter" && matches[index]) {
              e.preventDefault();
              onPick(matches[index]);
            } else if (e.key === "Escape") onCancel();
          }}
          placeholder="Buscar una página para enlazar…"
          aria-label="Buscar una página para enlazar"
          className="nd-menu-search"
        />
      </div>
      <div role="listbox" aria-label="Páginas" className="nd-scroll max-h-[240px] overflow-y-auto pb-1">
        {matches.length === 0 && <p className="nd-menu-empty">Sin resultados</p>}
        {matches.map((p, i) => (
          <button key={p.id} type="button" role="option" aria-selected={i === index} onMouseEnter={() => setIndex(i)} onClick={() => onPick(p)} className="nd-menu-item">
            <span className="nd-menu-icon">
              <PageIcon icon={p.icon} kind={p.kind} size={18} />
            </span>
            <span className="truncate">{p.title || "Sin título"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
export const PageLink = PageLinkBase.extend({ addNodeView: () => ReactNodeViewRenderer(PageLinkView) });

// ── Ruta de navegación ──
function BreadcrumbView({ editor }: NodeViewProps) {
  const ws = useOptionalWorkspace();
  const pageId = getPageId(editor);
  const path = ws && pageId ? pathTo(ws.pages, pageId) : [];
  return (
    <NodeViewWrapper className="nd-breadcrumb" data-testid="breadcrumb-block" contentEditable={false}>
      <nav aria-label="Ruta de la página" className="flex flex-wrap items-center gap-1 py-1 text-[14px] text-ink-2">
        {path.length === 0 && <span className="text-ink-3">Ruta de navegación</span>}
        {path.map((p, i) => (
          <span key={p.id} className="flex items-center gap-1">
            {i > 0 && <span className="text-ink-3">/</span>}
            <Link href={`/${p.id}`} className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-hover" draggable={false}>
              <PageIcon icon={p.icon} kind={p.kind} size={16} />
              <span className="max-w-[180px] truncate">{p.title || "Sin título"}</span>
            </Link>
          </span>
        ))}
      </nav>
    </NodeViewWrapper>
  );
}
export const Breadcrumb = BreadcrumbBase.extend({ addNodeView: () => ReactNodeViewRenderer(BreadcrumbView) });

// ── Archivo adjunto ──
function FileView({ node, deleteNode, editor, updateAttributes }: NodeViewProps) {
  const a = node.attrs as { url: string; name: string; size: number };
  const url = safeUrl(a.url);
  if (!a.url && editor.isEditable)
    return (
      <NodeViewWrapper contentEditable={false} data-testid="file-block">
        <MediaPicker kind="file" onFile={(f) => updateAttributes({ url: f.url, name: f.name, size: f.size })} onUrl={(u) => updateAttributes({ url: u, name: u.split("/").pop() || u })} onCancel={deleteNode} />
      </NodeViewWrapper>
    );
  return (
    <NodeViewWrapper className="nd-file-view group/file" data-testid="file-block" contentEditable={false}>
      <a href={url || undefined} download={a.name} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-2">
        <FileText size={18} className="shrink-0 text-ink-2" />
        <span className="truncate">{a.name}</span>
        {a.size > 0 && <span className="shrink-0 text-[13px] text-ink-3">{formatSize(a.size)}</span>}
        <Download size={14} className="ml-auto shrink-0 text-ink-3" />
      </a>
      {editor.isEditable && (
        <button type="button" aria-label="Eliminar archivo" onClick={deleteNode} className="rounded p-1 text-ink-3 opacity-0 hover:bg-hover group-hover/file:opacity-100 focus-visible:opacity-100">
          <Trash2 size={14} />
        </button>
      )}
    </NodeViewWrapper>
  );
}
export const FileBlock = FileBlockBase.extend({ addNodeView: () => ReactNodeViewRenderer(FileView) });

// ── Marcador ──
function BookmarkView({ node, deleteNode, editor, updateAttributes }: NodeViewProps) {
  const a = node.attrs as { url: string; title: string };
  const url = safeUrl(a.url);
  if (!a.url && editor.isEditable)
    return (
      <NodeViewWrapper contentEditable={false} data-testid="bookmark">
        <MediaPicker kind="bookmark" onUrl={(u) => updateAttributes({ url: u })} onCancel={deleteNode} />
      </NodeViewWrapper>
    );
  let host = a.url;
  try {
    host = new URL(a.url).hostname;
  } catch {}
  return (
    <NodeViewWrapper className="nd-bookmark-view group/bm" data-testid="bookmark" contentEditable={false}>
      <a href={url || undefined} target="_blank" rel="noopener noreferrer nofollow" className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{a.title || host}</span>
        <span className="flex items-center gap-1 truncate text-[13px] text-ink-3">
          <ExternalLink size={12} /> {a.url}
        </span>
      </a>
      {editor.isEditable && (
        <button type="button" aria-label="Eliminar marcador" onClick={deleteNode} className="rounded p-1 text-ink-3 opacity-0 hover:bg-hover group-hover/bm:opacity-100 focus-visible:opacity-100">
          <Trash2 size={14} />
        </button>
      )}
    </NodeViewWrapper>
  );
}
export const Bookmark = BookmarkBase.extend({ addNodeView: () => ReactNodeViewRenderer(BookmarkView) });

// ── Ecuaciones ──
function LatexEditor({ value, onCommit, onCancel, inline }: { value: string; onCommit: (v: string) => void; onCancel: () => void; inline?: boolean }) {
  const [text, setText] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const preview = useMemo(() => renderLatex(text, !inline), [text, inline]);
  return (
    <div className="nd-math-editor" data-testid="math-editor">
      <textarea
        ref={ref}
        value={text}
        rows={inline ? 1 : 3}
        aria-label="Expresión LaTeX"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
          if (e.key === "Enter" && (!inline ? e.ctrlKey || e.metaKey : true)) {
            e.preventDefault();
            onCommit(text.trim());
          }
          e.stopPropagation();
        }}
        className="w-full resize-none rounded-md border border-line bg-transparent p-2 font-mono text-[14px] outline-none focus:border-accent"
      />
      <div className="mt-1 min-h-6 text-center" aria-live="polite">
        {preview.error ? <span className="text-[13px] text-danger">Expresión no válida</span> : <span dangerouslySetInnerHTML={{ __html: preview.html }} />}
      </div>
      <div className="mt-1 flex justify-end gap-2 text-[13px]">
        <button type="button" onClick={onCancel} className="rounded px-2 py-1 hover:bg-hover">
          Cancelar
        </button>
        <button type="button" data-testid="math-done" onClick={() => onCommit(text.trim())} className="rounded bg-accent px-2 py-1 text-white" disabled={preview.error}>
          Listo
        </button>
      </div>
    </div>
  );
}

function MathBlockView({ node, updateAttributes, editor, deleteNode }: NodeViewProps) {
  const latex = String(node.attrs.latex);
  const [editing, setEditing] = useState(latex === "" && editor.isEditable);
  const out = useMemo(() => renderLatex(latex, true), [latex]);
  return (
    <NodeViewWrapper className="nd-math-view" data-testid="math-block" contentEditable={false}>
      {editing ? (
        <LatexEditor
          value={latex}
          onCancel={() => (latex ? setEditing(false) : deleteNode())}
          onCommit={(v) => {
            if (!v) return deleteNode();
            updateAttributes({ latex: v });
            setEditing(false);
          }}
        />
      ) : (
        <button type="button" disabled={!editor.isEditable} onClick={() => setEditing(true)} className="block w-full rounded-md p-2 text-center hover:bg-hover disabled:hover:bg-transparent" title="Editar ecuación">
          {out.error ? <span className="text-danger">Expresión no válida: {latex}</span> : <span dangerouslySetInnerHTML={{ __html: out.html }} />}
        </button>
      )}
    </NodeViewWrapper>
  );
}
export const MathBlock = MathBlockBase.extend({ addNodeView: () => ReactNodeViewRenderer(MathBlockView) });

function MathInlineView({ node, updateAttributes, editor, deleteNode }: NodeViewProps) {
  const latex = String(node.attrs.latex);
  const [editing, setEditing] = useState(latex === "" && editor.isEditable);
  const out = useMemo(() => renderLatex(latex, false), [latex]);
  return (
    <NodeViewWrapper as="span" className="nd-math-inline-view" data-testid="math-inline" contentEditable={false}>
      {editing ? (
        <LatexEditor
          inline
          value={latex}
          onCancel={() => (latex ? setEditing(false) : deleteNode())}
          onCommit={(v) => {
            if (!v) return deleteNode();
            updateAttributes({ latex: v });
            setEditing(false);
          }}
        />
      ) : (
        <span role="button" tabIndex={0} title="Editar ecuación" onClick={() => editor.isEditable && setEditing(true)} onKeyDown={(e) => e.key === "Enter" && editor.isEditable && setEditing(true)}>
          {out.error ? <span className="text-danger">{latex}</span> : <span dangerouslySetInnerHTML={{ __html: out.html }} />}
        </span>
      )}
    </NodeViewWrapper>
  );
}
export const MathInline = MathInlineBase.extend({
  addNodeView: () => ReactNodeViewRenderer(MathInlineView, { as: "span" }),
  // `$ecuación$` escrito en el texto se convierte en ecuación en línea.
  addInputRules() {
    return [
      new InputRule({
        find: /\$([^$\n]+)\$$/,
        handler: ({ state, range, match }) => {
          state.tr.replaceWith(range.from, range.to, this.type.create({ latex: match[1].trim() }));
        },
      }),
    ];
  },
});

// ── Tabla de contenidos ──
function TocView({ editor }: NodeViewProps) {
  const [items, setItems] = useState<{ level: number; text: string; pos: number }[]>([]);
  useEffect(() => {
    const collect = () => {
      const out: { level: number; text: string; pos: number }[] = [];
      editor.state.doc.descendants((n, pos) => {
        if (n.type.name === "heading" && n.textContent.trim()) out.push({ level: n.attrs.level as number, text: n.textContent, pos });
      });
      setItems(out);
    };
    collect();
    editor.on("update", collect);
    return () => void editor.off("update", collect);
  }, [editor]);
  return (
    <NodeViewWrapper className="nd-toc-view" data-testid="toc" contentEditable={false}>
      {items.length === 0 ? (
        <p className="text-ink-3">Añade encabezados para generar la tabla de contenidos.</p>
      ) : (
        <ul>
          {items.map((it, i) => (
            <li key={i} style={{ paddingLeft: (it.level - 1) * 16 }}>
              <button
                type="button"
                className="text-left text-ink-2 underline decoration-line underline-offset-2 hover:text-ink"
                onClick={() => {
                  const dom = editor.view.nodeDOM(it.pos);
                  if (dom instanceof HTMLElement) dom.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                {it.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </NodeViewWrapper>
  );
}
export const TableOfContents = TocBase.extend({ addNodeView: () => ReactNodeViewRenderer(TocView) });

export const nodeViewExtensions = { callout: Callout, imageBlock: ImageBlock, videoBlock: VideoBlock, audioBlock: AudioBlock, pageLink: PageLink, breadcrumb: Breadcrumb, fileBlock: FileBlock, bookmark: Bookmark, mathBlock: MathBlock, mathInline: MathInline, tableOfContents: TableOfContents };

/** Pegar o soltar archivos en el editor: las imágenes se insertan como imagen y el resto como archivo adjunto. */
export const MediaDrop = Extension.create({
  name: "mediaDrop",
  addProseMirrorPlugins() {
    const editor = this.editor;
    const insert = async (files: File[], at?: number) => {
      for (const file of files) {
        try {
          const up = await uploadFile(file);
          const node = IMAGE_TYPES.includes(file.type) ? { type: "imageBlock", attrs: { src: up.url, alt: up.name } } : { type: "fileBlock", attrs: { url: up.url, name: up.name, size: up.size } };
          if (at !== undefined) editor.chain().focus().insertContentAt(at, node).run();
          else editor.chain().focus().insertContent(node).run();
        } catch (err) {
          window.alert(err instanceof Error ? err.message : "No se pudo subir el archivo");
        }
      }
    };
    return [
      new Plugin({
        props: {
          handlePaste: (_view, event) => {
            const files = Array.from(event.clipboardData?.files ?? []);
            if (!files.length || !editor.isEditable) return false;
            void insert(files);
            return true;
          },
          handleDrop: (view, event) => {
            const files = Array.from(event.dataTransfer?.files ?? []);
            if (!files.length || !editor.isEditable) return false;
            const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
            void insert(files, at);
            return true;
          },
        },
      }),
    ];
  },
});

// ── Bloque de código con resaltado de sintaxis ──
const lowlight = createLowlight(common);
export const CODE_LANGUAGES: [string, string][] = [
  ["", "Automático"],
  ["plaintext", "Texto sin formato"],
  ["javascript", "JavaScript"],
  ["typescript", "TypeScript"],
  ["python", "Python"],
  ["java", "Java"],
  ["csharp", "C#"],
  ["cpp", "C++"],
  ["c", "C"],
  ["go", "Go"],
  ["rust", "Rust"],
  ["php", "PHP"],
  ["ruby", "Ruby"],
  ["swift", "Swift"],
  ["kotlin", "Kotlin"],
  ["sql", "SQL"],
  ["bash", "Bash"],
  ["json", "JSON"],
  ["yaml", "YAML"],
  ["xml", "HTML / XML"],
  ["css", "CSS"],
  ["markdown", "Markdown"],
];

function CodeView({ node, updateAttributes, editor }: NodeViewProps) {
  const [copied, setCopied] = useState(false);
  const language = (node.attrs.language as string | null) ?? "";
  return (
    <NodeViewWrapper className="nd-code-block group/code" data-testid="code-block">
      <div className="nd-code-bar" contentEditable={false}>
        <select value={language} disabled={!editor.isEditable} aria-label="Lenguaje del código" data-testid="code-language" onChange={(e) => updateAttributes({ language: e.target.value || null })}>
          {CODE_LANGUAGES.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
          {language && !CODE_LANGUAGES.some(([v]) => v === language) && <option value={language}>{language}</option>}
        </select>
        <button
          type="button"
          aria-label="Copiar código"
          data-testid="code-copy"
          onClick={async () => {
            await navigator.clipboard?.writeText(node.textContent).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>{copied ? "Copiado" : "Copiar"}</span>
        </button>
      </div>
      <pre>
        <NodeViewContent as={"code" as "div"} className={language ? `language-${language}` : undefined} />
      </pre>
    </NodeViewWrapper>
  );
}
export const RichCodeBlock = CodeBlockLowlight.extend({ addNodeView: () => ReactNodeViewRenderer(CodeView) }).configure({ lowlight, defaultLanguage: null });
