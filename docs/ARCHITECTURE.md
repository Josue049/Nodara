# Arquitectura

## Vista general
```
Navegador (React 19)                     Servidor Next.js 16 (Node 22)                 Datos
─────────────────────                    ───────────────────────────────               ─────────────────
components/*  ──fetch JSON──►  app/api/*  (Zod, api()/publicApi(), authz)  ──►  server/*-service.ts ──► PostgreSQL | PGlite
TipTap + Yjs  ◄──SSE stream──  api/collab/[id]/stream  (salas en memoria) ──►  page_ydocs / pages.content
              ──POST update──►  api/collab/[id]/update|awareness                 uploads (disco)
```

## Capas
| Capa | Ubicación | Responsabilidad |
|---|---|---|
| Interfaz | `app/src/components`, `app/src/app/(app)` | Páginas, editor, diálogos; estado en `workspace-provider` (árbol, favoritos, papelera) y `auth-provider` |
| Lógica pura | `app/src/lib/**` | Esquema del editor (`editor/schema.ts`), consultas y fórmulas de bases de datos (`collections/*`), Markdown/CSV (`export/*`), búsqueda (`search.ts`), plantillas (`templates.ts`), proveedor Yjs (`collab/provider.ts`). Sin DOM ni red: se prueba con Vitest y se comparte entre cliente y servidor |
| Rutas HTTP | `app/src/app/api/**` | Validación (Zod), autenticación (`api()` exige sesión y comprueba `Origin`; `publicApi()` la admite opcional), traducción de errores a HTTP |
| Servicios | `app/src/server/*-service.ts` | Reglas de negocio y acceso a datos con Drizzle; reciben `Db`, así que las pruebas usan PGlite en memoria |
| Autorización | `server/authz.ts` | `pageAccess` calcula el nivel efectivo (creador ∪ permisos heredados ∪ alcance del espacio por rol, con el bloqueo de página aplicado) |
| Datos | `server/db.ts`, `server/schema.ts`, `app/drizzle` | Driver dual: `DATABASE_URL` → `pg`; si no, PGlite. Migraciones aplicadas al arrancar |

## Decisiones clave
- **Filas = páginas**: un registro de base de datos es una página con `collection_id`; sus valores viven en `pages.properties` (jsonb por id de propiedad). Ninguna base de usuario crea tablas SQL; un registro se abre como página con su propio contenido.
- **Colaboración sin servidor WebSocket**: Yjs sobre Server-Sent Events (recibir) + `POST` (enviar). Funciona con `next start` y proxies HTTP; el cliente reencola y reenvía lo pendiente tras cortes (modo sin conexión). El servidor mantiene una sala por página (documento Yjs + presencia), persiste en `page_ydocs` y vuelca texto/JSON a `pages.content` para búsqueda, versiones y exportación. **Límite**: las salas viven en memoria de un proceso (una instancia).
- **Esquema del editor compartido**: `lib/editor/schema.ts` define los nodos sin React; el cliente les añade vistas (`components/editor/blocks.tsx`) con el mismo nombre, y el servidor usa la versión pura para convertir entre JSON de ProseMirror y Yjs.
- **Autorización siempre en el servidor**: la interfaz solo refleja permisos. Sin acceso se responde 404 (no revela existencia). Un barrido E2E comprueba 401 sin sesión en todas las rutas y ausencia de fugas entre espacios.
- **Seguridad de pruebas**: `/api/test/reset` existe solo con `NODARA_E2E=1` + token aleatorio + base desechable.
- **Datos fuera de `app/`**: PGlite y subidas viven en `<repo>/.data` para que el vigilante de Next no recargue en bucle.

## Pruebas
| Nivel | Herramienta | Qué cubre |
|---|---|---|
| Unitarias/integración | Vitest (`tests/unit`, `tests/integration`) | Servicios sobre PGlite, lógica pura, driver `pg` contra un servidor con protocolo Postgres y migración PGlite→Postgres |
| E2E | Playwright sobre un **build de producción** (`.next-e2e`) con base desechable | Flujos completos, colaboración con dos navegadores, accesibilidad (axe), seguridad, rendimiento con datos grandes |
| Orquestación | `scripts/test-seq.ps1` | lint → tipos → Vitest → build → E2E de forma secuencial (poca memoria); falla si algún paso falla o no se ejecuta ninguna prueba |

## Límites conocidos
Una instancia de aplicación; sin envío de correo; archivos en disco local; sin regresión visual por píxeles.
