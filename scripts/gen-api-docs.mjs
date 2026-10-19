// Genera docs/API.md a partir de las rutas de app/src/app/api (método, ruta y comentario que las precede).
// Uso: tools/node/node.exe scripts/gen-api-docs.mjs
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve("app/src/app/api");
const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f === "route.ts") files.push(p);
  }
})(root);

const rows = [];
for (const file of files) {
  const route = "/api/" + path.relative(root, path.dirname(file)).split(path.sep).filter(Boolean).map((s) => s.replace(/^\[(.+)\]$/, ":$1")).join("/");
  const src = readFileSync(file, "utf8");
  const lines = src.split(/\r?\n/);
  const isPublic = /publicApi/.test(src) && !/\bapi\(/.test(src);
  lines.forEach((l, i) => {
    const m = /^export const (GET|POST|PUT|PATCH|DELETE) = (api|publicApi)\(/.exec(l) ?? /^export async function (GET|POST|PUT|PATCH|DELETE)\(/.exec(l);
    if (!m) return;
    let doc = "";
    for (let k = i - 1; k >= 0 && /^\s*(\/\/|\/\*\*|\*)/.test(lines[k]); k--) doc = lines[k].replace(/^\s*(\/\/|\/\*\*|\*\/|\*)\s?/, "").replace(/\*\/\s*$/, "").trim() + " " + doc;
    const auth = m[2] === "publicApi" || m[2] === undefined ? "pública / opcional" : "sesión";
    rows.push([route, m[1], auth, doc.trim()]);
  });
}
rows.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
const md = `# API HTTP de Nodara

Generada con \`scripts/gen-api-docs.mjs\` (${rows.length} operaciones). Todas las rutas devuelven JSON salvo las descargas (exportaciones, archivos) y el canal SSE de colaboración.

- **Autenticación**: cookie \`nodara_session\` (HttpOnly, SameSite=Lax). Las operaciones «sesión» devuelven 401 sin ella.
- **CSRF**: las operaciones que modifican datos rechazan un \`Origin\` distinto del host (403).
- **Permisos**: se comprueban en el servidor por página (\`view < comment < edit < full\`); sin acceso se responde 404 para no revelar la existencia.
- **Errores**: \`{ "error": "mensaje" }\` con 400 (datos no válidos, con \`issues\`), 401, 403, 404, 409, 413 o 429.

| Ruta | Método | Acceso | Descripción |
|---|---|---|---|
${rows.map((r) => `| \`${r[0]}\` | ${r[1]} | ${r[2]} | ${r[3].replace(/\|/g, "\|")} |`).join("\n")}
`;
writeFileSync("docs/API.md", md);
console.log(`docs/API.md: ${rows.length} operaciones`);
