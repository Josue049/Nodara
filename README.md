# Nodara

Alternativa open source a Notion: páginas anidadas, editor de bloques, bases de datos y colaboración.
Implementación independiente (sin código, logotipos ni activos de Notion), guiada por observación del comportamiento público de Notion Web.

> Estado real y límites: ver [`docs/STATUS.md`](docs/STATUS.md).

## Requisitos
- Windows 11 + PowerShell, Git y Google Chrome. No hacen falta Docker ni PostgreSQL: la base es **PGlite** (Postgres real en WASM) persistida en `.data/`.
- Node 22.19+ (el proyecto usa un Node portable en `tools/node`, sin tocar el global).

## Uso
```powershell
.\scripts\setup.ps1   # Node portable verificado, REA y dependencias
.\scripts\dev.ps1     # http://localhost:3000
.\scripts\test.ps1    # lint + tipos + unitarias + E2E
```
Variables: `NODARA_DATA_DIR` (ruta de datos; `memory://` para efímera). Ver `app/`.

## Qué funciona hoy (Hito 1)
Shell con sidebar, páginas anidadas (crear, subpáginas, expandir/contraer), título con autoguardado, favoritos, papelera (restaurar / eliminar definitivamente), migas de pan, API REST validada. Detalle en [`docs/FEATURE_MATRIX.md`](docs/FEATURE_MATRIX.md).

## Investigación
`research/` contiene capturas y notas. Herramienta: [REA](https://github.com/morluto/rea) (clon independiente en `tools/rea`, ignorado por este repo). Scripts en `scripts/` (`start-research-browser.ps1`, `list-targets.ps1`, `inspect-notion.ps1`, `capture-screenshot.ps1`).

Licencia: MIT.
