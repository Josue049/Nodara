/**
 * Motor de fórmulas de Nodara: analizador recursivo descendente + evaluador.
 * Sintaxis inspirada en las fórmulas de Notion: prop("Nombre"), if(c, a, b), operadores aritméticos,
 * de comparación y lógicos (and/or/not, &&, ||, !), cadenas "…", números, true/false.
 * Las fechas se manejan como `Date`; las listas como arrays.
 */

export class FormulaError extends Error {}

export type FValue = number | string | boolean | Date | FValue[] | null;

type Node =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "bool"; v: boolean }
  | { t: "call"; name: string; args: Node[] }
  | { t: "un"; op: string; a: Node }
  | { t: "bin"; op: string; a: Node; b: Node };

// ── Léxico ───────────────────────────────────────────────────────────
type Tok = { k: "num" | "str" | "id" | "op" | "(" | ")" | "," | "end"; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
    } else if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      out.push({ k: "num", v: src.slice(i, j) });
      i = j;
    } else if (c === '"') {
      let j = i + 1;
      let s = "";
      while (j < src.length && src[j] !== '"') {
        if (src[j] === "\\" && j + 1 < src.length) {
          const n = src[j + 1];
          s += n === "n" ? "\n" : n === "t" ? "\t" : n;
          j += 2;
        } else s += src[j++];
      }
      if (src[j] !== '"') throw new FormulaError("Cadena sin cerrar");
      out.push({ k: "str", v: s });
      i = j + 1;
    } else if (/[A-Za-z_áéíóúñÁÉÍÓÚÑ]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_áéíóúñÁÉÍÓÚÑ]/.test(src[j])) j++;
      out.push({ k: "id", v: src.slice(i, j) });
      i = j;
    } else if (c === "(" || c === ")" || c === ",") {
      out.push({ k: c, v: c });
      i++;
    } else {
      const two = src.slice(i, i + 2);
      if (["==", "!=", ">=", "<=", "&&", "||"].includes(two)) {
        out.push({ k: "op", v: two });
        i += 2;
      } else if ("+-*/%^<>!".includes(c)) {
        out.push({ k: "op", v: c });
        i++;
      } else throw new FormulaError(`Carácter inesperado «${c}»`);
    }
  }
  out.push({ k: "end", v: "" });
  return out;
}

// ── Sintaxis (precedencia: or < and < igualdad < comparación < suma < producto < potencia < unario) ──
class Parser {
  private p = 0;
  constructor(private toks: Tok[]) {}
  private get cur() {
    return this.toks[this.p];
  }
  private eat() {
    return this.toks[this.p++];
  }
  private peek(): Tok["k"] {
    return this.toks[this.p].k;
  }
  parse(): Node {
    const n = this.or();
    if (this.cur.k !== "end") throw new FormulaError(`Sobra «${this.cur.v}»`);
    return n;
  }
  private isOp(...ops: string[]) {
    return this.cur.k === "op" && ops.includes(this.cur.v);
  }
  private isWord(w: string) {
    return this.cur.k === "id" && this.cur.v.toLowerCase() === w;
  }
  private or(): Node {
    let a = this.and();
    while (this.isOp("||") || this.isWord("or")) {
      this.eat();
      a = { t: "bin", op: "or", a, b: this.and() };
    }
    return a;
  }
  private and(): Node {
    let a = this.eq();
    while (this.isOp("&&") || this.isWord("and")) {
      this.eat();
      a = { t: "bin", op: "and", a, b: this.eq() };
    }
    return a;
  }
  private eq(): Node {
    let a = this.cmp();
    while (this.isOp("==", "!=")) a = { t: "bin", op: this.eat().v, a, b: this.cmp() };
    return a;
  }
  private cmp(): Node {
    let a = this.add();
    while (this.isOp("<", ">", "<=", ">=")) a = { t: "bin", op: this.eat().v, a, b: this.add() };
    return a;
  }
  private add(): Node {
    let a = this.mul();
    while (this.isOp("+", "-")) a = { t: "bin", op: this.eat().v, a, b: this.mul() };
    return a;
  }
  private mul(): Node {
    let a = this.pow();
    while (this.isOp("*", "/", "%")) a = { t: "bin", op: this.eat().v, a, b: this.pow() };
    return a;
  }
  private pow(): Node {
    const a = this.unary();
    if (this.isOp("^")) {
      this.eat();
      return { t: "bin", op: "^", a, b: this.pow() }; // asociativa a la derecha
    }
    return a;
  }
  private unary(): Node {
    if (this.isOp("-", "!") || this.isWord("not")) {
      const op = this.eat().v.toLowerCase();
      return { t: "un", op: op === "!" ? "not" : op, a: this.unary() };
    }
    return this.atom();
  }
  private atom(): Node {
    const tok = this.eat();
    if (tok.k === "num") return { t: "num", v: Number(tok.v) };
    if (tok.k === "str") return { t: "str", v: tok.v };
    if (tok.k === "(") {
      const n = this.or();
      if (this.eat().k !== ")") throw new FormulaError("Falta «)»");
      return n;
    }
    if (tok.k === "id") {
      const lower = tok.v.toLowerCase();
      if (lower === "true" || lower === "false") return { t: "bool", v: lower === "true" };
      if (this.cur.k === "(") {
        this.eat();
        const args: Node[] = [];
        if (this.peek() !== ")") {
          args.push(this.or());
          while (this.peek() === ",") {
            this.eat();
            args.push(this.or());
          }
        }
        if (this.eat().k !== ")") throw new FormulaError(`Falta «)» en ${tok.v}()`);
        return { t: "call", name: lower, args };
      }
      throw new FormulaError(`«${tok.v}» no es una función; usa prop("Nombre") para leer propiedades`);
    }
    throw new FormulaError(tok.k === "end" ? "Expresión incompleta" : `Inesperado «${tok.v}»`);
  }
}

export function parseFormula(src: string): Node {
  if (!src.trim()) throw new FormulaError("Fórmula vacía");
  return new Parser(tokenize(src)).parse();
}

/** Nombres de propiedad referenciados con prop("…"). */
export function referencedProps(src: string): string[] {
  const out: string[] = [];
  const walk = (n: Node) => {
    if (n.t === "call") {
      if (n.name === "prop" && n.args[0]?.t === "str") out.push(n.args[0].v);
      n.args.forEach(walk);
    } else if (n.t === "un") walk(n.a);
    else if (n.t === "bin") {
      walk(n.a);
      walk(n.b);
    }
  };
  walk(parseFormula(src));
  return out;
}

// ── Evaluación ───────────────────────────────────────────────────────
export type FormulaContext = { prop: (name: string) => FValue; now?: () => Date };

const isDate = (v: unknown): v is Date => v instanceof Date;
const toStr = (v: FValue): string =>
  v === null ? "" : isDate(v) ? v.toISOString() : Array.isArray(v) ? v.map(toStr).join(", ") : String(v);
const toNum = (v: FValue): number => {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (isDate(v)) return v.getTime();
  if (typeof v === "string") {
    const n = Number(v.replace(/,/g, ""));
    if (Number.isNaN(n)) throw new FormulaError(`«${v}» no es un número`);
    return n;
  }
  if (v === null) return 0;
  throw new FormulaError("Se esperaba un número");
};
const truthy = (v: FValue): boolean =>
  v === null ? false : typeof v === "boolean" ? v : typeof v === "number" ? v !== 0 : typeof v === "string" ? v !== "" : isDate(v) ? true : v.length > 0;

const UNIT_MS: Record<string, number> = { seconds: 1e3, minutes: 6e4, hours: 36e5, days: 864e5, weeks: 6048e5 };
const unitOf = (u: FValue) => toStr(u).toLowerCase();

function addToDate(d: Date, n: number, unit: string): Date {
  const out = new Date(d.getTime());
  if (unit in UNIT_MS) return new Date(d.getTime() + n * UNIT_MS[unit]);
  if (unit === "months") out.setUTCMonth(out.getUTCMonth() + n);
  else if (unit === "years") out.setUTCFullYear(out.getUTCFullYear() + n);
  else throw new FormulaError(`Unidad de fecha desconocida «${unit}»`);
  return out;
}

function dateBetween(a: Date, b: Date, unit: string): number {
  if (unit in UNIT_MS) return Math.trunc((a.getTime() - b.getTime()) / UNIT_MS[unit]);
  const months = (a.getUTCFullYear() - b.getUTCFullYear()) * 12 + (a.getUTCMonth() - b.getUTCMonth());
  if (unit === "months") return months;
  if (unit === "years") return Math.trunc(months / 12);
  throw new FormulaError(`Unidad de fecha desconocida «${unit}»`);
}

function asDate(v: FValue): Date {
  if (isDate(v)) return v;
  const d = new Date(toStr(v));
  if (Number.isNaN(d.getTime())) throw new FormulaError(`«${toStr(v)}» no es una fecha`);
  return d;
}

const looseEq = (a: FValue, b: FValue): boolean => {
  if (isDate(a) && isDate(b)) return a.getTime() === b.getTime();
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => looseEq(x, b[i]));
  return a === b;
};

const compare = (a: FValue, b: FValue): number => {
  if (isDate(a) || isDate(b)) return asDate(a).getTime() - asDate(b).getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  return toStr(a) < toStr(b) ? -1 : toStr(a) > toStr(b) ? 1 : 0;
};

const flat = (args: FValue[]): FValue[] => args.flatMap((a) => (Array.isArray(a) ? flat(a) : [a]));

const FUNCS: Record<string, (args: FValue[], ctx: FormulaContext) => FValue> = {
  prop: ([name], ctx) => ctx.prop(toStr(name)),
  empty: ([v]) => v === null || v === "" || (Array.isArray(v) && v.length === 0),
  length: ([v]) => (Array.isArray(v) ? v.length : toStr(v).length),
  concat: (a) => a.map(toStr).join(""),
  join: ([list, sep]) => (Array.isArray(list) ? list.map(toStr).join(sep === undefined ? ", " : toStr(sep)) : toStr(list)),
  contains: ([hay, needle]) =>
    Array.isArray(hay) ? hay.some((x) => looseEq(x, needle ?? null)) : toStr(hay).toLowerCase().includes(toStr(needle ?? null).toLowerCase()),
  replace: ([s, from, to]) => toStr(s).replace(toStr(from), toStr(to ?? "")),
  replaceall: ([s, from, to]) => toStr(s).split(toStr(from)).join(toStr(to ?? "")),
  lower: ([s]) => toStr(s).toLowerCase(),
  upper: ([s]) => toStr(s).toUpperCase(),
  trim: ([s]) => toStr(s).trim(),
  substring: ([s, a, b]) => toStr(s).substring(toNum(a), b === undefined ? undefined : toNum(b)),
  test: ([s, re]) => new RegExp(toStr(re)).test(toStr(s)),
  round: ([n, places]) => {
    const f = 10 ** (places === undefined ? 0 : toNum(places));
    return Math.round(toNum(n) * f) / f;
  },
  floor: ([n]) => Math.floor(toNum(n)),
  ceil: ([n]) => Math.ceil(toNum(n)),
  abs: ([n]) => Math.abs(toNum(n)),
  sqrt: ([n]) => Math.sqrt(toNum(n)),
  sign: ([n]) => Math.sign(toNum(n)),
  pow: ([a, b]) => toNum(a) ** toNum(b),
  mod: ([a, b]) => toNum(a) % toNum(b),
  min: (a) => Math.min(...flat(a).map(toNum)),
  max: (a) => Math.max(...flat(a).map(toNum)),
  sum: (a) => flat(a).map(toNum).reduce((x, y) => x + y, 0),
  mean: (a) => {
    const n = flat(a).map(toNum);
    return n.length ? n.reduce((x, y) => x + y, 0) / n.length : null;
  },
  tonumber: ([v]) => toNum(v),
  format: ([v]) => toStr(v),
  not: ([v]) => !truthy(v),
  and: (a) => a.every(truthy),
  or: (a) => a.some(truthy),
  now: (_a, ctx) => (ctx.now ?? (() => new Date()))(),
  today: (_a, ctx) => {
    const d = (ctx.now ?? (() => new Date()))();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  },
  dateadd: ([d, n, u]) => addToDate(asDate(d), toNum(n), unitOf(u)),
  datesubtract: ([d, n, u]) => addToDate(asDate(d), -toNum(n), unitOf(u)),
  datebetween: ([a, b, u]) => dateBetween(asDate(a), asDate(b), unitOf(u)),
  year: ([d]) => asDate(d).getUTCFullYear(),
  month: ([d]) => asDate(d).getUTCMonth() + 1,
  date: ([d]) => asDate(d).getUTCDate(),
  day: ([d]) => asDate(d).getUTCDay() || 7,
  formatdate: ([d]) => asDate(d).toISOString().slice(0, 10),
};

function evalNode(n: Node, ctx: FormulaContext): FValue {
  switch (n.t) {
    case "num":
    case "str":
    case "bool":
      return n.v;
    case "un":
      return n.op === "-" ? -toNum(evalNode(n.a, ctx)) : !truthy(evalNode(n.a, ctx));
    case "bin": {
      if (n.op === "and") return truthy(evalNode(n.a, ctx)) && truthy(evalNode(n.b, ctx));
      if (n.op === "or") return truthy(evalNode(n.a, ctx)) || truthy(evalNode(n.b, ctx));
      const a = evalNode(n.a, ctx);
      const b = evalNode(n.b, ctx);
      switch (n.op) {
        case "+":
          return typeof a === "string" || typeof b === "string" ? toStr(a) + toStr(b) : toNum(a) + toNum(b);
        case "-":
          return isDate(a) && isDate(b) ? a.getTime() - b.getTime() : toNum(a) - toNum(b);
        case "*":
          return toNum(a) * toNum(b);
        case "/": {
          const d = toNum(b);
          if (d === 0) throw new FormulaError("División entre cero");
          return toNum(a) / d;
        }
        case "%":
          return toNum(a) % toNum(b);
        case "^":
          return toNum(a) ** toNum(b);
        case "==":
          return looseEq(a, b);
        case "!=":
          return !looseEq(a, b);
        case "<":
          return compare(a, b) < 0;
        case ">":
          return compare(a, b) > 0;
        case "<=":
          return compare(a, b) <= 0;
        case ">=":
          return compare(a, b) >= 0;
      }
      throw new FormulaError(`Operador desconocido ${n.op}`);
    }
    case "call": {
      if (n.name === "if") {
        if (n.args.length < 2) throw new FormulaError("if() necesita al menos 2 argumentos");
        return truthy(evalNode(n.args[0], ctx)) ? evalNode(n.args[1], ctx) : n.args[2] ? evalNode(n.args[2], ctx) : null;
      }
      if (n.name === "ifs") {
        for (let i = 0; i + 1 < n.args.length; i += 2) if (truthy(evalNode(n.args[i], ctx))) return evalNode(n.args[i + 1], ctx);
        return n.args.length % 2 ? evalNode(n.args[n.args.length - 1], ctx) : null;
      }
      const fn = FUNCS[n.name];
      if (!fn) throw new FormulaError(`Función desconocida «${n.name}»`);
      return fn(n.args.map((a) => evalNode(a, ctx)), ctx);
    }
  }
}

/** Evalúa una fórmula. Lanza FormulaError si es inválida. */
export function evaluateFormula(src: string, ctx: FormulaContext): FValue {
  return evalNode(parseFormula(src), ctx);
}

/** Comprueba sintaxis y que las propiedades referenciadas existan. Devuelve el mensaje de error o null. */
export function validateFormula(src: string, propNames: string[]): string | null {
  try {
    const missing = referencedProps(src).filter((p) => !propNames.includes(p));
    return missing.length ? `Propiedad desconocida: ${missing[0]}` : null;
  } catch (e) {
    return e instanceof FormulaError ? e.message : "Fórmula no válida";
  }
}
