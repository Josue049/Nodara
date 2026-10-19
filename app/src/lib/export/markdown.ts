/**
 * Conversión entre el documento del editor (JSON de ProseMirror) y Markdown / HTML.
 * Lógica pura, sin DOM: se usa en el servidor (exportar/importar) y en pruebas unitarias.
 */

export type Mark = { type: string; attrs?: Record<string, unknown> };
export type DocNode = { type: string; attrs?: Record<string, unknown>; content?: DocNode[]; text?: string; marks?: Mark[] };

const SAFE_URL = /^(https?:\/\/|mailto:|\/api\/files\/|\/)/i;
const safe = (u: unknown) => (typeof u === "string" && SAFE_URL.test(u) ? u : "");

// ───────────────────────── Documento → Markdown ─────────────────────────

const escMd = (s: string) => s.replace(/([\\`*_{}\[\]<>~|])/g, "\\$1");

function inlineMd(nodes: DocNode[] = []): string {
  return nodes
    .map((n) => {
      if (n.type === "hardBreak") return "  \n";
      if (n.type === "mention") return `@${n.attrs?.label ?? n.attrs?.id ?? ""}`;
      if (n.type === "mathInline") return `$${n.attrs?.latex ?? ""}$`;
      if (n.type !== "text") return inlineMd(n.content);
      const marks = n.marks ?? [];
      const has = (t: string) => marks.find((m) => m.type === t);
      let out = has("code") ? `\`${(n.text ?? "").replace(/`/g, "'")}\`` : escMd(n.text ?? "");
      if (has("bold")) out = `**${out}**`;
      if (has("italic")) out = `*${out}*`;
      if (has("strike")) out = `~~${out}~~`;
      if (has("underline")) out = `<u>${out}</u>`;
      const link = has("link");
      if (link && safe(link.attrs?.href)) out = `[${out}](${String(link.attrs?.href)})`;
      return out;
    })
    .join("");
}

function listMd(node: DocNode, depth: number): string {
  const ordered = node.type === "orderedList";
  const task = node.type === "taskList";
  const pad = "  ".repeat(depth);
  return (node.content ?? [])
    .map((item, i) => {
      const [first, ...rest] = item.content ?? [];
      const marker = task ? `- [${item.attrs?.checked ? "x" : " "}] ` : ordered ? `${i + 1}. ` : "- ";
      const head = first ? (first.type === "paragraph" ? inlineMd(first.content) : blockMd(first, depth + 1).trim()) : "";
      const tail = rest
        .map((c) => (["bulletList", "orderedList", "taskList"].includes(c.type) ? listMd(c, depth + 1) : `${pad}  ${blockMd(c, depth + 1).trim()}`))
        .join("\n");
      return `${pad}${marker}${head}${tail ? `\n${tail}` : ""}`;
    })
    .join("\n");
}

function tableMd(node: DocNode): string {
  const rows = (node.content ?? []).map((r) => (r.content ?? []).map((c) => (c.content ?? []).map((p) => inlineMd(p.content)).join(" ").replace(/\|/g, "\\|") || " "));
  if (rows.length === 0) return "";
  const width = Math.max(...rows.map((r) => r.length));
  const pad = (r: string[]) => `| ${[...r, ...Array(width - r.length).fill(" ")].join(" | ")} |`;
  return [pad(rows[0]), `| ${Array(width).fill("---").join(" | ")} |`, ...rows.slice(1).map(pad)].join("\n");
}

function blockMd(node: DocNode, depth = 0): string {
  const children = () => (node.content ?? []).map((c) => blockMd(c, depth)).filter((s) => s !== "").join("\n\n");
  switch (node.type) {
    case "paragraph":
      return inlineMd(node.content);
    case "heading":
      return `${"#".repeat(Number(node.attrs?.level ?? 1))} ${inlineMd(node.content)}`;
    case "bulletList":
    case "orderedList":
    case "taskList":
      return listMd(node, depth);
    case "blockquote":
      return children().split("\n").map((l) => `> ${l}`).join("\n");
    case "callout":
      return children().split("\n").map((l, i) => (i === 0 ? `> ${node.attrs?.icon ?? "💡"} ${l}` : `> ${l}`)).join("\n");
    case "codeBlock":
      return `\`\`\`${node.attrs?.language ?? ""}\n${(node.content ?? []).map((t) => t.text ?? "").join("")}\n\`\`\``;
    case "horizontalRule":
      return "---";
    case "table":
      return tableMd(node);
    case "details": {
      const summary = (node.content ?? []).find((c) => c.type === "detailsSummary");
      const body = (node.content ?? []).find((c) => c.type === "detailsContent");
      return `<details>\n<summary>${inlineMd(summary?.content)}</summary>\n\n${(body?.content ?? []).map((c) => blockMd(c, depth)).join("\n\n")}\n\n</details>`;
    }
    case "imageBlock": {
      const src = safe(node.attrs?.src);
      return src ? `![${escMd(String(node.attrs?.alt ?? ""))}](${src})${node.attrs?.caption ? `\n\n*${escMd(String(node.attrs.caption))}*` : ""}` : "";
    }
    case "fileBlock":
    case "bookmark": {
      const url = safe(node.attrs?.url);
      const label = String(node.attrs?.name ?? node.attrs?.title ?? node.attrs?.url ?? "Enlace");
      return url ? `[${escMd(label)}](${url})` : escMd(label);
    }
    case "mathBlock":
      return `$$\n${node.attrs?.latex ?? ""}\n$$`;
    case "tableOfContents":
      return "[TOC]";
    case "columnList":
    case "column":
      return children();
    case "databaseBlock":
      return "*[Base de datos integrada]*";
    case "doc":
      return children();
    default:
      return node.content ? children() : "";
  }
}

export function docToMarkdown(doc: unknown, title?: string): string {
  const body = blockMd((doc as DocNode) ?? { type: "doc", content: [] });
  return `${title ? `# ${escMd(title)}\n\n` : ""}${body}\n`;
}

// ───────────────────────── Documento → HTML ─────────────────────────

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inlineHtml(nodes: DocNode[] = []): string {
  return nodes
    .map((n) => {
      if (n.type === "hardBreak") return "<br>";
      if (n.type === "mention") return `<span class="mention">@${esc(String(n.attrs?.label ?? n.attrs?.id ?? ""))}</span>`;
      if (n.type === "mathInline") return `<code class="math">${esc(String(n.attrs?.latex ?? ""))}</code>`;
      if (n.type !== "text") return inlineHtml(n.content);
      let out = esc(n.text ?? "");
      for (const m of n.marks ?? []) {
        if (m.type === "bold") out = `<strong>${out}</strong>`;
        else if (m.type === "italic") out = `<em>${out}</em>`;
        else if (m.type === "strike") out = `<s>${out}</s>`;
        else if (m.type === "underline") out = `<u>${out}</u>`;
        else if (m.type === "code") out = `<code>${out}</code>`;
        else if (m.type === "highlight") out = `<mark>${out}</mark>`;
        else if (m.type === "link" && safe(m.attrs?.href)) out = `<a href="${esc(String(m.attrs?.href))}" rel="noopener noreferrer nofollow">${out}</a>`;
      }
      return out;
    })
    .join("");
}

function blockHtml(node: DocNode): string {
  const kids = () => (node.content ?? []).map(blockHtml).join("");
  switch (node.type) {
    case "paragraph":
      return `<p>${inlineHtml(node.content)}</p>`;
    case "heading": {
      const l = Math.min(3, Math.max(1, Number(node.attrs?.level ?? 1)));
      return `<h${l}>${inlineHtml(node.content)}</h${l}>`;
    }
    case "bulletList":
      return `<ul>${kids()}</ul>`;
    case "orderedList":
      return `<ol>${kids()}</ol>`;
    case "taskList":
      return `<ul class="tasks">${kids()}</ul>`;
    case "listItem":
      return `<li>${kids()}</li>`;
    case "taskItem":
      return `<li><input type="checkbox" disabled${node.attrs?.checked ? " checked" : ""}> ${kids()}</li>`;
    case "blockquote":
      return `<blockquote>${kids()}</blockquote>`;
    case "callout":
      return `<aside class="callout"><span>${esc(String(node.attrs?.icon ?? "💡"))}</span><div>${kids()}</div></aside>`;
    case "codeBlock":
      return `<pre><code>${esc((node.content ?? []).map((t) => t.text ?? "").join(""))}</code></pre>`;
    case "horizontalRule":
      return "<hr>";
    case "table":
      return `<table>${kids()}</table>`;
    case "tableRow":
      return `<tr>${kids()}</tr>`;
    case "tableHeader":
      return `<th>${kids()}</th>`;
    case "tableCell":
      return `<td>${kids()}</td>`;
    case "details": {
      const summary = (node.content ?? []).find((c) => c.type === "detailsSummary");
      const body = (node.content ?? []).find((c) => c.type === "detailsContent");
      return `<details><summary>${inlineHtml(summary?.content)}</summary>${(body?.content ?? []).map(blockHtml).join("")}</details>`;
    }
    case "imageBlock": {
      const src = safe(node.attrs?.src);
      return src ? `<figure><img src="${esc(src)}" alt="${esc(String(node.attrs?.alt ?? ""))}">${node.attrs?.caption ? `<figcaption>${esc(String(node.attrs.caption))}</figcaption>` : ""}</figure>` : "";
    }
    case "fileBlock":
    case "bookmark": {
      const url = safe(node.attrs?.url);
      const label = esc(String(node.attrs?.name ?? node.attrs?.title ?? node.attrs?.url ?? "Enlace"));
      return url ? `<p><a href="${esc(url)}" rel="noopener noreferrer nofollow">${label}</a></p>` : `<p>${label}</p>`;
    }
    case "mathBlock":
      return `<pre class="math">${esc(String(node.attrs?.latex ?? ""))}</pre>`;
    case "columnList":
      return `<div class="columns" style="display:flex;gap:2rem">${kids()}</div>`;
    case "column":
      return `<div style="flex:1">${kids()}</div>`;
    case "tableOfContents":
    case "databaseBlock":
      return "";
    default:
      return kids();
  }
}

export function docToHtml(doc: unknown, title = "Sin título"): string {
  return `<!doctype html>\n<html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title>\n<style>body{font:16px/1.5 system-ui,sans-serif;max-width:46rem;margin:3rem auto;padding:0 1rem;color:#2c2c2b}pre{background:#f7f6f3;padding:1rem;overflow:auto}code{background:#f1efec;padding:0 .25em;border-radius:3px}blockquote{border-left:3px solid #2c2c2b;margin-left:0;padding-left:1rem}table{border-collapse:collapse}td,th{border:1px solid #ddd;padding:.3rem .6rem}.callout{display:flex;gap:.5rem;background:#f1efec;padding:1rem;border-radius:6px}img{max-width:100%}</style></head>\n<body><h1>${esc(title)}</h1>\n${blockHtml((doc as DocNode) ?? { type: "doc" })}\n</body></html>\n`;
}

// ───────────────────────── Markdown → Documento ─────────────────────────

function textNode(text: string, marks: Mark[]): DocNode {
  return marks.length ? { type: "text", text, marks } : { type: "text", text };
}

/** Elementos en línea de Markdown: `código`, **negrita**, *cursiva*, ~~tachado~~, [enlace](url) y $ecuación$. */
export function parseInline(src: string, marks: Mark[] = []): DocNode[] {
  const out: DocNode[] = [];
  let buf = "";
  const flush = () => {
    if (buf) out.push(textNode(buf, marks));
    buf = "";
  };
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "\\" && i + 1 < src.length) {
      buf += src[i + 1];
      i += 2;
      continue;
    }
    if (c === "`") {
      const end = src.indexOf("`", i + 1);
      if (end > i) {
        flush();
        out.push(textNode(src.slice(i + 1, end), [...marks, { type: "code" }]));
        i = end + 1;
        continue;
      }
    }
    if (c === "$") {
      const m = /^\$([^$\n]+)\$/.exec(src.slice(i));
      if (m && !/^\s|\s$/.test(m[1])) {
        flush();
        out.push({ type: "mathInline", attrs: { latex: m[1] } });
        i += m[0].length;
        continue;
      }
    }
    if (c === "[") {
      const m = /^\[([^\]]*)\]\(([^)\s]+)\)/.exec(src.slice(i));
      if (m) {
        flush();
        const href = safe(m[2]) || (/^[\w.-]+\.[a-z]{2,}/i.test(m[2]) ? `https://${m[2]}` : "");
        out.push(...parseInline(m[1], href ? [...marks, { type: "link", attrs: { href } }] : marks));
        i += m[0].length;
        continue;
      }
    }
    let matched = false;
    for (const [tok, type] of [["**", "bold"], ["~~", "strike"], ["__", "bold"], ["*", "italic"], ["_", "italic"]] as const) {
      if (!src.startsWith(tok, i)) continue;
      const end = src.indexOf(tok, i + tok.length);
      if (end > i + tok.length && !(tok === "_" && /\w/.test(src[i - 1] ?? ""))) {
        flush();
        out.push(...parseInline(src.slice(i + tok.length, end), [...marks, { type }]));
        i = end + tok.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    buf += c;
    i++;
  }
  flush();
  return out;
}

const isSpecialStart = (l: string) => /^(#{1,6}\s|```|\$\$|>\s?|[-*+]\s|\d+[.)]\s|---+\s*$|\*\*\*+\s*$|\|)/.test(l.trim());

type ListLine = { indent: number; kind: "bullet" | "ordered" | "task"; checked: boolean; text: string };
const LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(?:\[([ xX])\]\s+)?(.*)$/;
function parseListLine(line: string): ListLine | null {
  const m = LIST_RE.exec(line.replace(/\t/g, "    "));
  if (!m) return null;
  return { indent: Math.floor(m[1].length / 2), kind: m[3] !== undefined ? "task" : /\d/.test(m[2]) ? "ordered" : "bullet", checked: /x/i.test(m[3] ?? ""), text: m[4] };
}

function buildList(lines: ListLine[]): DocNode[] {
  const out: DocNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const base = lines[i];
    const kind = base.kind;
    const items: DocNode[] = [];
    while (i < lines.length && lines[i].indent === base.indent && lines[i].kind === kind) {
      const l = lines[i++];
      const sub: ListLine[] = [];
      while (i < lines.length && lines[i].indent > base.indent) sub.push(lines[i++]);
      const content: DocNode[] = [{ type: "paragraph", content: parseInline(l.text) }, ...(sub.length ? buildList(sub) : [])];
      items.push(kind === "task" ? { type: "taskItem", attrs: { checked: l.checked }, content } : { type: "listItem", content });
    }
    out.push({ type: kind === "task" ? "taskList" : kind === "ordered" ? "orderedList" : "bulletList", content: items });
    if (i < lines.length && lines[i].indent < base.indent) break;
  }
  return out;
}

const splitRow = (l: string) => l.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));

export function markdownToDoc(md: string): { title: string | null; doc: DocNode } {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const blocks: DocNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();
    if (!t) {
      i++;
      continue;
    }
    const fence = /^```\s*([\w+-]*)/.exec(t);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) body.push(lines[i++]);
      i++;
      blocks.push({ type: "codeBlock", attrs: { language: fence[1] || null }, content: body.length ? [{ type: "text", text: body.join("\n") }] : undefined });
      continue;
    }
    if (t === "$$" || /^\$\$[^$]+\$\$$/.test(t)) {
      if (t !== "$$") {
        blocks.push({ type: "mathBlock", attrs: { latex: t.slice(2, -2).trim() } });
        i++;
        continue;
      }
      const body: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== "$$") body.push(lines[i++]);
      i++;
      blocks.push({ type: "mathBlock", attrs: { latex: body.join("\n").trim() } });
      continue;
    }
    const h = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(t);
    if (h) {
      blocks.push({ type: "heading", attrs: { level: Math.min(3, h[1].length) }, content: parseInline(h[2]) });
      i++;
      continue;
    }
    if (/^(---+|\*\*\*+|___+)$/.test(t)) {
      blocks.push({ type: "horizontalRule" });
      i++;
      continue;
    }
    if (t === "[TOC]") {
      blocks.push({ type: "tableOfContents" });
      i++;
      continue;
    }
    if (t.startsWith(">")) {
      const body: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) body.push(lines[i++].trim().replace(/^>\s?/, ""));
      const inner = markdownToDoc(body.join("\n")).doc.content ?? [];
      const icon = /^(\p{Extended_Pictographic}️?)\s/u.exec(body[0] ?? "");
      if (icon) {
        const first = inner[0];
        if (first?.type === "paragraph" && first.content?.[0]?.text) first.content[0].text = first.content[0].text.replace(/^\p{Extended_Pictographic}️?\s/u, "");
        blocks.push({ type: "callout", attrs: { icon: icon[1], color: "gray" }, content: inner.length ? inner : [{ type: "paragraph" }] });
      } else blocks.push({ type: "blockquote", content: inner.length ? inner : [{ type: "paragraph" }] });
      continue;
    }
    if (parseListLine(line)) {
      const items: ListLine[] = [];
      while (i < lines.length && lines[i].trim() && parseListLine(lines[i])) items.push(parseListLine(lines[i++])!);
      blocks.push(...buildList(items));
      continue;
    }
    if (t.startsWith("|") && i + 1 < lines.length && /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1].trim())) {
      const head = splitRow(t);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(splitRow(lines[i++]));
      const cell = (type: string, text: string): DocNode => ({ type, content: [{ type: "paragraph", content: parseInline(text) }] });
      blocks.push({
        type: "table",
        content: [
          { type: "tableRow", content: head.map((c) => cell("tableHeader", c)) },
          ...rows.map((r) => ({ type: "tableRow", content: head.map((_, k) => cell("tableCell", r[k] ?? "")) })),
        ],
      });
      continue;
    }
    const img = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(t);
    if (img && /^https?:\/\/|^\/api\/files\//i.test(img[2])) {
      blocks.push({ type: "imageBlock", attrs: { src: img[2], alt: img[1], caption: "", width: 100, align: "center" } });
      i++;
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && (para.length === 0 || !isSpecialStart(lines[i]))) para.push(lines[i++].trim());
    blocks.push({ type: "paragraph", content: parseInline(para.join(" ")) });
  }
  let title: string | null = null;
  if (blocks[0]?.type === "heading" && blocks[0].attrs?.level === 1) {
    title = (blocks[0].content ?? []).map((n) => n.text ?? "").join("");
    blocks.shift();
  }
  return { title, doc: { type: "doc", content: blocks.length ? blocks : [{ type: "paragraph" }] } };
}
