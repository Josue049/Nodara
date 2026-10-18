# Arquitectura

- **Frontend/Backend**: Next.js 16 (App Router) + React 19 + Tailwind 4, TypeScript. Route Handlers en `app/src/app/api`.
- **Datos**: Drizzle ORM sobre **PGlite** (Postgres real en WASM, persistido en `<repo>/.data/pglite`). Migraciones en `app/drizzle` (`drizzle-kit generate`), aplicadas al arrancar (`createDb`). Cambiar a un Postgres externo es sustituir el driver en `src/server/db.ts`.
  - Decisión: sin Docker ni PostgreSQL en la máquina; PGlite mantiene semántica Postgres. Los datos viven fuera de `app/` para no disparar el HMR de Next.
- **Capas**: `server/pages-service.ts` (lógica, probada con Vitest en memoria) → `app/api/*` (validación Zod, mapeo de errores) → `components/workspace-provider.tsx` (estado cliente con actualización optimista) → UI.
- **Modelo**: `pages` (árbol por `parent_id`, `position`, `is_favorite`, `deleted_at`, `content jsonb` reservado al editor). La papelera marca la página y sus descendientes con el mismo `deleted_at`, lo que permite restaurar el subárbol exacto.
- **Pruebas**: Vitest (`tests/unit`), Playwright con Chrome del sistema (`tests/e2e`, base desechable en `.data/e2e`).
- **Pendiente de decidir**: autenticación (Hito 5), Yjs/WebSockets (Hito 6; requiere servidor propio fuera de Next).
