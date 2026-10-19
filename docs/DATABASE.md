# Base de datos

Motor principal: **PostgreSQL 17** (instalado en el equipo). Sin `DATABASE_URL`, Nodara usa PGlite (Postgres embebido en `.data/pglite`): mismo dialecto y mismas migraciones, útil para desarrollo sin servidor y para las pruebas E2E.

## Puesta en marcha con tu PostgreSQL (una sola vez)
1. `.\scripts\setup-postgres.ps1` — pide la contraseña del superusuario `postgres` (no se guarda), crea el rol `nodara` y las bases **`nodara`** y **`nodara_test`** (no toca ninguna otra) y escribe `app\.env` con una contraseña aleatoria. Es idempotente.
2. `.\scripts\migrate-to-postgres.ps1` — copia los datos de PGlite a PostgreSQL: respaldo previo del directorio PGlite, una transacción, verificación de conteos, aborta si el destino ya tiene datos (`-Force` para reemplazar). El origen no se modifica.
3. `.\scripts\dev.ps1` — con `DATABASE_URL` en `app\.env`, Nodara usa PostgreSQL. Las migraciones de `app\drizzle` se aplican solas al arrancar.

`app\.env.example` documenta las variables. `app\.env` está ignorado por Git.

## Respaldo y restauración
- Respaldo: `.\scripts\db-backup.ps1` → `backups\nodara-<fecha>.dump` (`pg_dump -Fc`; con PGlite copia el directorio).
- Ensayar restauración (seguro, en `nodara_test`): `.\scripts\db-restore.ps1 -File backups\nodara-….dump`.
- Restaurar sobre la base real: `.\scripts\db-restore.ps1 -File … -Target nodara -Confirm` (reemplaza su contenido; haz un respaldo antes).

## Seguridad de las pruebas
`POST /api/test/reset` responde 404 salvo que se cumplan todas: `NODARA_E2E=1`, `NODE_ENV≠production` y base desechable (PGlite en un directorio `e2e`, memoria, o Postgres cuyo nombre termina en `_test`). El servidor E2E fuerza `DATABASE_URL` vacío, así que nunca toca PostgreSQL.

## Integridad
Operaciones de varios pasos (papelera, restaurar, mover, duplicar) usan transacciones. Índice por `parent_id`. Las pruebas `tests/integration` ejercitan el driver `pg` y la migración contra un servidor con protocolo PostgreSQL; con `DATABASE_URL_TEST` (base `*_test`) se ejecutan contra el PostgreSQL real.

## Estructura (modelo flexible, sin tablas por base de datos de usuario)
| Tabla | Rol |
|---|---|
| `pages` | Árbol de páginas. `kind='database'` aloja una base de página completa; si `collection_id` no es nulo, la página **es un registro** y sus valores están en `properties` (jsonb, por id de propiedad). Índices: `parent_id`, `collection_id`. |
| `collections` | Una base de datos (anfitrión `host_page_id`, título/icono si es integrada). |
| `collection_properties` | Definición de columnas: `type` + `config` jsonb (opciones, formato, fórmula, relación, rollup). |
| `collection_views` | Vistas: `type` + `config` jsonb (filtro, orden, grupo, visibles, cálculos…). |
| `collection_templates` | Plantillas de fila (título, valores, contenido). |

Relaciones: `pages.collection_id → collections` y `collections.host_page_id → pages` (cascada). Las operaciones multipaso (papelera, mover, duplicar, altas y ediciones de registros con relaciones recíprocas, creación de bases y propiedades) corren en transacciones. Archivos subidos: `.data/uploads` (`NODARA_UPLOAD_DIR`), servidos por `/api/files/<uuid>` con `nosniff`; **inclúyelos en tus respaldos**: `pg_dump` solo cubre la base.
