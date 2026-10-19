# Contribuir a Nodara

¡Gracias por querer ayudar! Nodara es una alternativa open source a Notion hecha desde cero: **no se acepta código, textos ni activos copiados de Notion**. El comportamiento se documenta por observación (ver `research/`), separando *hechos observados* de *hipótesis*.

## Entorno
- Windows: `.\scripts\setup.ps1` instala un Node portable verificado en `tools/node` y las dependencias. En otros sistemas basta con Node 22.19+ y `cd app && npm ci`.
- Arranque: `.\scripts\dev.ps1` (o `cd app && npm run dev`) → <http://localhost:3000>. Sin `DATABASE_URL` usa PGlite en `.data/`.
- Los datos viven **fuera de `app/`** (si no, el vigilante de Next recarga en bucle).

## Comprobaciones antes de abrir un PR
```powershell
.\scripts\test-seq.ps1 -All      # lint → tipos → Vitest → build → E2E (un solo worker, poca memoria)
.\scripts\test-seq.ps1 -SkipStatic -Only 09,13   # solo algunos archivos E2E
```
- Los E2E compilan un build de producción en `app/.next-e2e` con una base desechable y reinician el estado en cada prueba. `/api/test/reset` solo existe con `NODARA_E2E=1` y un token aleatorio.
- Una ejecución interrumpida **no** es una ejecución aprobada: el script termina con error si algún paso falla o si el filtro no selecciona ninguna prueba.
- Toda funcionalidad nueva incluye: implementación completa (UI + API + persistencia), pruebas unitarias o E2E, y actualización de `docs/FEATURE_MATRIX.md`.

## Estilo
- Interfaz y mensajes en **español**; los textos compartidos en `app/src/lib/strings.ts`.
- TypeScript estricto, sin `any`. Comentarios solo cuando explican el *porqué*.
- Lógica pura (consultas, fórmulas, conversión Markdown, búsqueda) en `app/src/lib/**` con pruebas unitarias; acceso a datos en `app/src/server/*-service.ts`; rutas finas en `app/src/app/api/**`.
- Migraciones: edita `app/src/server/schema.ts` y ejecuta `npx drizzle-kit generate --name <cambio>`; añade la tabla nueva a `app/scripts/lib/table-order.mjs` (una prueba comprueba que cubre el esquema).
- Accesibilidad: todo control con nombre accesible, foco visible, diálogos con foco atrapado (`components/modal.tsx`).

## Seguridad
- No subas credenciales, cookies ni tokens. Los secretos van en `app/.env` (ignorado).
- Autorización siempre en el servidor (`assertPage`, `assertMember`…); la interfaz solo refleja permisos.
- Informa de vulnerabilidades en privado a los mantenedores antes de publicarlas.

## Mensajes de commit
Resumen en español en imperativo («Añade…», «Corrige…») y, si procede, el porqué en el cuerpo.
