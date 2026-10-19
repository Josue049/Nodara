# Nodara

Alternativa open source a Notion: páginas anidadas, editor de bloques, bases de datos y colaboración.
Implementación independiente (sin código, logotipos ni activos de Notion), guiada por observación del comportamiento público de Notion Web.

> Estado real y límites: ver [`docs/STATUS.md`](docs/STATUS.md).

## Requisitos
- Windows 11 + PowerShell, Git y Google Chrome. Base de datos: **PostgreSQL** (`DATABASE_URL` en `app/.env`, ver `docs/DATABASE.md`) o, sin ella, **PGlite** (Postgres real en WASM) en `.data/`.
- Node 22.19+ (el proyecto usa un Node portable en `tools/node`, sin tocar el global).

## Uso
```powershell
.\scripts\setup.ps1   # Node portable verificado, REA y dependencias
.\scripts\dev.ps1     # http://localhost:3000
.\scripts\test.ps1    # lint + tipos + unitarias + E2E
```
Variables: `DATABASE_URL`, `NODARA_DATA_DIR`, `NODARA_UPLOAD_DIR` (ver `app/.env.example`). Las pruebas E2E compilan un build de producción en `.next-e2e` con una base desechable.

## Qué funciona hoy
Páginas anidadas (mover, duplicar, renombrar, papelera, favoritos, búsqueda Ctrl+K, iconos, tema claro/oscuro), editor de bloques (menú /, formato flotante, asa de bloque, tablas) y bases de datos con vistas tabla, tablero, lista, galería, calendario y cronograma; propiedades (selección, estado, fecha, archivos, relación, rollup, fórmula…), filtros, orden, agrupación, cálculos y plantillas. Detalle en [`docs/FEATURE_MATRIX.md`](docs/FEATURE_MATRIX.md).

## Investigación
`research/` contiene capturas y notas. Herramienta: [REA](https://github.com/morluto/rea) (clon independiente en `tools/rea`, ignorado por este repo). Scripts en `scripts/` (`start-research-browser.ps1`, `list-targets.ps1`, `inspect-notion.ps1`, `capture-screenshot.ps1`).

Licencia: MIT.
