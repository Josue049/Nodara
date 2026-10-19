/** Lógica de búsqueda pura: normalización sin acentos, varios términos, puntuación y resaltado. */

export const MARK_OPEN = "\u0001";
export const MARK_CLOSE = "\u0002";

/** Minúsculas y sin diacríticos, **conservando la longitud** (así los índices valen para el texto original). */
export function fold(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const folded = s[i].normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    out += folded.length === 1 ? folded : (folded[0] ?? s[i]);
  }
  return out;
}

/** Términos de la consulta: palabras sueltas o frases entre comillas, normalizadas; sin repetidos. */
export function parseQuery(q: string): string[] {
  const terms: string[] = [];
  const re = /"([^"]+)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(q))) {
    const t = fold((m[1] ?? m[2]).trim());
    if (t && !terms.includes(t)) terms.push(t);
  }
  return terms;
}

export type Score = { score: number; titleHit: boolean; contentHit: boolean; firstContentAt: number };

/**
 * Puntuación de una página para unos términos: TODOS deben aparecer (en título o contenido).
 * Título exacto > empieza por > contiene > solo en contenido; más coincidencias en el contenido suman poco.
 */
export function scoreDocument(title: string, content: string, terms: string[], titlesOnly = false): Score | null {
  const ft = fold(title);
  const fc = titlesOnly ? "" : fold(content);
  if (terms.length === 0) return { score: 0, titleHit: false, contentHit: false, firstContentAt: -1 };
  let score = 0;
  let titleHit = false;
  let contentHit = false;
  let firstContentAt = -1;
  for (const term of terms) {
    const inTitle = ft.indexOf(term);
    const inContent = fc.indexOf(term);
    if (inTitle < 0 && inContent < 0) return null;
    if (inTitle >= 0) {
      titleHit = true;
      score += ft === term ? 100 : inTitle === 0 ? 60 : 40;
    }
    if (inContent >= 0) {
      contentHit = true;
      if (firstContentAt < 0 || inContent < firstContentAt) firstContentAt = inContent;
      let count = 0;
      for (let i = fc.indexOf(term); i >= 0 && count < 10; i = fc.indexOf(term, i + term.length)) count++;
      score += 10 + count;
    }
  }
  return { score, titleHit, contentHit, firstContentAt };
}

/** Rodea con marcas cada aparición de los términos (sin acentos ni mayúsculas) dentro de `text`. */
export function markTerms(text: string, terms: string[]): string {
  if (terms.length === 0 || !text) return text;
  const f = fold(text);
  const hit = new Array<boolean>(text.length).fill(false);
  for (const term of terms) for (let i = f.indexOf(term); i >= 0; i = f.indexOf(term, i + term.length)) for (let k = 0; k < term.length; k++) hit[i + k] = true;
  let out = "";
  let on = false;
  for (let i = 0; i < text.length; i++) {
    if (hit[i] && !on) out += MARK_OPEN;
    if (!hit[i] && on) out += MARK_CLOSE;
    on = hit[i];
    out += text[i];
  }
  return on ? out + MARK_CLOSE : out;
}

/** Fragmento del contenido alrededor de la primera coincidencia, con las coincidencias marcadas. */
export function makeSnippet(content: string, terms: string[], at: number, before = 40, after = 90): string {
  if (at < 0) return "";
  const start = Math.max(0, at - before);
  const end = Math.min(content.length, at + after);
  return (start > 0 ? "…" : "") + markTerms(content.slice(start, end), terms) + (end < content.length ? "…" : "");
}

/** Divide un texto con marcas en trozos `{ text, hit }` para pintarlos (sin usar HTML). */
export function splitMarks(marked: string): { text: string; hit: boolean }[] {
  const out: { text: string; hit: boolean }[] = [];
  let hit = false;
  let buf = "";
  for (const ch of marked) {
    if (ch === MARK_OPEN || ch === MARK_CLOSE) {
      if (buf) out.push({ text: buf, hit });
      buf = "";
      hit = ch === MARK_OPEN;
    } else buf += ch;
  }
  if (buf) out.push({ text: buf, hit });
  return out;
}

export const EDITED_WINDOWS = { day: 1, week: 7, month: 30, year: 365 } as const;
export type EditedWindow = keyof typeof EDITED_WINDOWS;
