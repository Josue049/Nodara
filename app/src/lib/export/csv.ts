/** CSV (RFC 4180) para importar y exportar bases de datos. Lógica pura. */

/** Detecta el separador más probable mirando la primera línea (fuera de comillas). */
export function detectDelimiter(text: string): string {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  let best = ",";
  let bestCount = 0;
  for (const d of [",", ";", "\t"]) {
    let inQuotes = false;
    let count = 0;
    for (const ch of first) {
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === d && !inQuotes) count++;
    }
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

export function parseCsv(input: string, delimiter = detectDelimiter(input)): string[][] {
  const text = input.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") inQuotes = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Evita la inyección de fórmulas al abrir el CSV en una hoja de cálculo. */
const neutralize = (s: string) => (/^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s) ? `'${s}` : s);

export function toCsv(rows: (string | number | boolean | null | undefined)[][], delimiter = ","): string {
  const esc = (v: string | number | boolean | null | undefined) => {
    const s = neutralize(v === null || v === undefined ? "" : String(v));
    return /[",\n\r;\t]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `﻿${rows.map((r) => r.map(esc).join(delimiter)).join("\r\n")}\r\n`;
}

export type InferredType = "text" | "number" | "checkbox" | "date" | "url" | "email" | "select";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const NUM = /^-?\d+([.,]\d+)?$/;

/** Deduce el tipo de propiedad de una columna a partir de sus valores no vacíos. */
export function inferColumnType(values: string[]): InferredType {
  const v = values.map((x) => x.trim()).filter(Boolean);
  if (v.length === 0) return "text";
  if (v.every((x) => /^(true|false|sí|si|no|yes)$/i.test(x))) return "checkbox";
  if (v.every((x) => NUM.test(x))) return "number";
  if (v.every((x) => ISO_DAY.test(x) && !Number.isNaN(Date.parse(x)))) return "date";
  if (v.every((x) => /^https?:\/\/\S+$/i.test(x))) return "url";
  if (v.every((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x))) return "email";
  const distinct = new Set(v);
  if (v.length >= 4 && distinct.size <= 6 && distinct.size <= v.length / 2 && v.every((x) => x.length <= 40)) return "select";
  return "text";
}

export const parseBool = (s: string) => /^(true|sí|si|yes|1)$/i.test(s.trim());
export const parseNumber = (s: string) => Number(s.trim().replace(",", "."));
