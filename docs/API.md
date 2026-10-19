# API HTTP de Nodara

Generada con `scripts/gen-api-docs.mjs` (90 operaciones). Todas las rutas devuelven JSON salvo las descargas (exportaciones, archivos) y el canal SSE de colaboración.

- **Autenticación**: cookie `nodara_session` (HttpOnly, SameSite=Lax). Las operaciones «sesión» devuelven 401 sin ella.
- **CSRF**: las operaciones que modifican datos rechazan un `Origin` distinto del host (403).
- **Permisos**: se comprueban en el servidor por página (`view < comment < edit < full`); sin acceso se responde 404 para no revelar la existencia.
- **Errores**: `{ "error": "mensaje" }` con 400 (datos no válidos, con `issues`), 401, 403, 404, 409, 413 o 429.

| Ruta | Método | Acceso | Descripción |
|---|---|---|---|
| `/api/auth/login` | POST | pública / opcional |  |
| `/api/auth/logout` | POST | pública / opcional |  |
| `/api/auth/reset/:token` | GET | pública / opcional |  |
| `/api/auth/reset/:token` | POST | pública / opcional |  |
| `/api/auth/signup` | POST | pública / opcional |  |
| `/api/collab/:id/awareness` | POST | sesión |  |
| `/api/collab/:id/stream` | GET | sesión | Canal Server-Sent Events: sincronización inicial, actualizaciones del documento y presencia. |
| `/api/collab/:id/update` | POST | sesión |  |
| `/api/comments/:id` | DELETE | sesión |  |
| `/api/comments/:id` | PATCH | sesión |  |
| `/api/comments/:id` | POST | sesión | POST responde a un hilo (el id es el del comentario raíz). |
| `/api/databases` | GET | sesión |  |
| `/api/databases` | POST | sesión |  |
| `/api/databases/:id` | GET | sesión |  |
| `/api/databases/:id` | PATCH | sesión |  |
| `/api/databases/:id/export` | GET | sesión |  |
| `/api/databases/:id/properties` | POST | sesión |  |
| `/api/databases/:id/query` | POST | sesión |  |
| `/api/databases/:id/records` | POST | sesión |  |
| `/api/databases/:id/templates` | GET | sesión |  |
| `/api/databases/:id/templates` | POST | sesión |  |
| `/api/databases/:id/views` | POST | sesión |  |
| `/api/files` | POST | sesión |  |
| `/api/files/:id` | GET | sesión |  |
| `/api/health` | GET | pública / opcional | Comprobación de salud para balanceadores y orquestadores: no exige sesión y no revela datos internos. |
| `/api/import` | POST | sesión | Importa un archivo .md/.markdown/.txt (página), .json (exportación de Nodara) o .csv (base de datos). |
| `/api/invitations/:token` | GET | pública / opcional |  |
| `/api/invitations/:token/accept` | POST | sesión |  |
| `/api/me` | GET | pública / opcional |  |
| `/api/me` | PATCH | pública / opcional |  |
| `/api/me/password` | POST | sesión |  |
| `/api/me/workspace` | POST | sesión |  |
| `/api/notifications` | GET | sesión |  |
| `/api/notifications` | PATCH | sesión |  |
| `/api/page-templates` | GET | sesión |  |
| `/api/page-templates` | POST | sesión | Guarda una página como plantilla del espacio de trabajo. |
| `/api/page-templates/:id` | DELETE | sesión |  |
| `/api/page-templates/use` | POST | sesión | Crea una página nueva a partir de una plantilla (integrada: «builtin:<clave>», o del espacio de trabajo). |
| `/api/pages` | GET | sesión |  |
| `/api/pages` | POST | sesión |  |
| `/api/pages/:id` | DELETE | sesión | Sin parámetros envía a la papelera; con ?permanent=1 elimina definitivamente (solo desde la papelera, con acceso completo). |
| `/api/pages/:id` | GET | sesión |  |
| `/api/pages/:id` | PATCH | sesión |  |
| `/api/pages/:id/analytics` | GET | sesión | Estadísticas de la página: solo quien puede editarla. |
| `/api/pages/:id/analytics` | POST | sesión | Registra una visita de la persona actual (una por día se acumula en el contador). |
| `/api/pages/:id/comments` | GET | sesión |  |
| `/api/pages/:id/comments` | POST | sesión |  |
| `/api/pages/:id/database` | GET | sesión |  |
| `/api/pages/:id/duplicate` | POST | sesión |  |
| `/api/pages/:id/export` | GET | sesión | Descarga la página como Markdown, HTML o JSON. |
| `/api/pages/:id/move` | POST | sesión |  |
| `/api/pages/:id/permissions/:userId` | DELETE | sesión |  |
| `/api/pages/:id/permissions/:userId` | PATCH | sesión |  |
| `/api/pages/:id/publish` | DELETE | sesión |  |
| `/api/pages/:id/publish` | POST | sesión |  |
| `/api/pages/:id/restore` | POST | sesión |  |
| `/api/pages/:id/scope` | PUT | sesión |  |
| `/api/pages/:id/share` | POST | sesión |  |
| `/api/pages/:id/sharing` | GET | sesión |  |
| `/api/pages/:id/versions` | GET | sesión |  |
| `/api/pages/:id/versions/:versionId` | GET | sesión |  |
| `/api/pages/:id/versions/:versionId/restore` | POST | sesión |  |
| `/api/properties/:id` | DELETE | sesión |  |
| `/api/properties/:id` | PATCH | sesión |  |
| `/api/properties/:id/options` | POST | sesión |  |
| `/api/public/:token` | GET | pública / opcional | Página publicada (o una de sus subpáginas con ?page=). No exige sesión. |
| `/api/public/:token/databases/:cid/query` | POST | pública / opcional |  |
| `/api/public/:token/pages/:id` | PATCH | pública / opcional | Edición anónima: solo si el enlace se publicó con nivel «edit». |
| `/api/records/:id` | GET | sesión | Registro como página: datos de la página, definición de su base y valores calculados. |
| `/api/records/:id` | PATCH | sesión |  |
| `/api/search` | GET | sesión |  |
| `/api/templates/:id` | DELETE | sesión |  |
| `/api/templates/:id` | PATCH | sesión |  |
| `/api/test/reset` | POST | pública / opcional | Solo para E2E. Responde 404 salvo que se cumplan TODAS estas condiciones: 1. NODARA_E2E=1 y NODARA_E2E_TOKEN definido (solo lo fija el lanzador de las pruebas, con un valor aleatorio por ejecución); 2. la petición lleva ese token en la cabecera x-nodara-e2e-token; 3. la base de datos es desechable (PGlite en un directorio `e2e`, memoria, o Postgres cuyo nombre acaba en `_test`). Una instalación normal nunca define NODARA_E2E_TOKEN, así que el endpoint no existe para ella. |
| `/api/trash` | GET | sesión |  |
| `/api/views/:id` | DELETE | sesión |  |
| `/api/views/:id` | PATCH | sesión |  |
| `/api/views/:id/duplicate` | POST | sesión |  |
| `/api/workspaces` | GET | sesión |  |
| `/api/workspaces` | POST | sesión |  |
| `/api/workspaces/:id` | DELETE | sesión |  |
| `/api/workspaces/:id` | PATCH | sesión |  |
| `/api/workspaces/:id/audit` | GET | sesión | Registro de auditoría (solo propietarios y administradores). `?format=csv` lo descarga. |
| `/api/workspaces/:id/export` | GET | sesión | Copia de seguridad del espacio de trabajo en JSON (solo propietarios y administradores). |
| `/api/workspaces/:id/invitations` | POST | sesión |  |
| `/api/workspaces/:id/invitations/:invId` | DELETE | sesión |  |
| `/api/workspaces/:id/members` | GET | sesión |  |
| `/api/workspaces/:id/members/:userId` | DELETE | sesión |  |
| `/api/workspaces/:id/members/:userId` | PATCH | sesión |  |
| `/api/workspaces/:id/members/:userId/reset` | POST | sesión | Genera un enlace de restablecimiento de contraseña (solo propietarios y administradores). |
