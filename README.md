# Nodara

**El espacio de trabajo todo en uno, autoalojable y en español**: páginas anidadas, editor de bloques, bases de datos con seis vistas, colaboración en tiempo real, comentarios, permisos y publicación. Se instala con Docker o con Node + PostgreSQL.

## Inspiración
Nodara nace de la admiración por herramientas como Notion y su idea de que documentos, wikis y bases de datos convivan en un mismo lugar. Es un producto independiente, escrito desde cero: no contiene código, textos, logotipos ni activos de terceros.

<p align="center">
  <img src="docs/images/pagina-clara.png" alt="Página con portada, llamada, columnas, ecuación y código (tema claro)" width="49%">
  <img src="docs/images/pagina-oscura.png" alt="La misma página en tema oscuro" width="49%">
</p>
<p align="center">
  <img src="docs/images/base-de-datos.png" alt="Base de datos en vista de tabla" width="49%">
  <img src="docs/images/busqueda.png" alt="Búsqueda avanzada con filtros y resaltado" width="49%">
</p>

## Qué incluye
| Área | Funcionalidades |
|---|---|
| **Páginas** | Árbol anidado con arrastrar y soltar, favoritos, papelera, duplicar, mover, iconos, **portada**, tipografía (sans/serif/mono), texto pequeño, ancho completo, **bloqueo de página**, historial de versiones con restauración |
| **Editor** | Menú `/`, formato flotante, asa de bloque, listas, tareas, desplegables, tablas, citas, **código con resaltado**, **llamadas**, **columnas**, **imágenes** (subir, pegar, soltar, redimensionar, pie), **archivos**, **marcadores**, **ecuaciones** LaTeX (KaTeX, en bloque y en línea), **tabla de contenidos**, menciones `@` |
| **Bases de datos** | Tabla, tablero, lista, galería, calendario y cronograma; propiedades de texto, número, selección, estado, fecha, **persona**, casilla, URL, correo, teléfono, archivos, relación (bidireccional), rollup, fórmula, creado/editado/**creado por**; filtros AND/OR, orden, agrupación, cálculos, plantillas de fila, bases integradas, **ventana lateral** |
| **Colaboración** | Edición simultánea con Yjs (sin servidor WebSocket propio: SSE + POST), presencia y cursores con nombre, modo sin conexión con fusión al volver, **comentarios** anclados con respuestas y resolución, bandeja de entrada de menciones |
| **Equipos** | Cuentas, espacios de trabajo, roles (propietario/administrador/miembro/invitado), invitaciones y **restablecimiento de contraseña** por enlace, permisos por página heredables, enlaces públicos de solo lectura/comentar/editar, **registro de auditoría**, **analíticas de página** |
| **Datos** | **Importar** Markdown/texto/JSON/CSV; **exportar** Markdown/HTML/JSON/CSV/PDF (imprimir); plantillas de página (integradas y propias); copia de seguridad del espacio; búsqueda avanzada (varios términos, resaltado, filtros por fecha, autor, tipo y subárbol) |
| **Experiencia** | Tema claro/oscuro/sistema, responsive con barra lateral deslizable, atajos (`Ctrl+K`, `Ctrl+\`, `Ctrl+/`…), accesibilidad (diálogos con foco atrapado, «saltar al contenido», `prefers-reduced-motion`), impresión |

## Inicio rápido
### Con Docker (PostgreSQL incluido)
```bash
cp deploy/.env.example .env     # define POSTGRES_PASSWORD
docker compose up -d --build    # http://localhost:3000
```
### Sin Docker
```bash
cd app && npm ci && npm run build && npx next start     # PGlite en ../.data si no hay DATABASE_URL
# con PostgreSQL:  DATABASE_URL=postgresql://nodara:clave@127.0.0.1:5432/nodara npx next start
```
La primera cuenta creada adopta el espacio de trabajo y es propietaria. Guía completa (proxy HTTPS con SSE, systemd, copias de seguridad, lista de comprobación de seguridad): [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

### Desarrollo en Windows
```powershell
.\scripts\setup.ps1   # Node portable verificado (tools/node) y dependencias
.\scripts\dev.ps1     # http://localhost:3000
.\scripts\test-seq.ps1 -All   # lint → tipos → Vitest → build → E2E (secuencial, poca memoria)
```

## Arquitectura en una mirada
- **App**: Next.js 16 (App Router) · React 19 · Tailwind 4 · TipTap 3 (ProseMirror) · Yjs · Drizzle ORM.
- **Datos**: PostgreSQL (o PGlite embebido) con migraciones automáticas. Las filas de una base de datos son páginas (`pages.collection_id`); ninguna base de usuario crea tablas SQL.
- **Tiempo real**: sin proceso aparte; las salas Yjs viven en el servidor Next (una instancia). Detalle y límites en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
- **Seguridad**: contraseñas scrypt, sesiones con hash SHA-256, cookie HttpOnly/SameSite, protección CSRF por `Origin`, CSP y cabeceras, límites de intentos, autorización por página en el servidor, auditoría. Ver [`docs/SECURITY.md`](docs/SECURITY.md).
- **API**: 90 operaciones documentadas en [`docs/API.md`](docs/API.md) (`GET /api/health` para monitores).

## Calidad
La suite completa se ejecuta con `scripts/test-seq.ps1 -All`: ESLint, TypeScript, pruebas unitarias/integración (Vitest, incluyendo el driver `pg` y la migración desde PGlite) y pruebas E2E (Playwright sobre un **build de producción** con base desechable, una prueba = un estado limpio).
## Documentación
[`ROADMAP`](docs/ROADMAP.md) · [`ARCHITECTURE`](docs/ARCHITECTURE.md) · [`DATABASE`](docs/DATABASE.md) · [`SECURITY`](docs/SECURITY.md) · [`LIMITATIONS`](docs/LIMITATIONS.md) · [`DEPLOYMENT`](docs/DEPLOYMENT.md) · [`API`](docs/API.md) · [`CONTRIBUTING`](CONTRIBUTING.md)

## Límites conocidos
Una sola instancia de aplicación (salas colaborativas en memoria), sin envío de correo (enlaces de un solo uso), archivos en disco local, sin vistas vinculadas entre bases ni «última edición por» en propiedades. Lista completa y honesta en [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md).

## Desarrollador
Desarrollado por **Josue** ([@Josue049](https://github.com/Josue049)).

## Licencia
MIT. Notion es una marca registrada de Notion Labs, Inc.; Nodara no está afiliado, patrocinado ni respaldado por Notion Labs.
