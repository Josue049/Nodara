# Guía de despliegue

Nodara es una aplicación Next.js 16 (Node 22+) con PostgreSQL. Esta guía cubre tres caminos: **Docker Compose** (recomendado), **instalación directa con systemd** y **modo local con PGlite** (sin servidor de base de datos).

> Estado de verificación: el camino Docker está escrito pero **no se ha podido ejecutar en la máquina de desarrollo** (no tiene Docker). El camino directo y el modo local sí se prueban en cada ejecución de la suite (`scripts/test-seq.ps1`).

## Requisitos
| Componente | Versión | Notas |
|---|---|---|
| Node.js | 22.19 o superior | Solo para instalación directa; la imagen Docker ya lo incluye |
| PostgreSQL | 15 o superior (probado con 17) | Opcional: sin `DATABASE_URL` se usa PGlite embebido |
| Proxy inverso | nginx, Caddy, Traefik… | Necesario para HTTPS; debe permitir SSE sin buffering |

## Variables de entorno
| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL` | No* | `postgresql://usuario:clave@host:5432/nodara`. Sin ella se usa PGlite en `NODARA_DATA_DIR` |
| `NODARA_DATA_DIR` | No | Directorio de PGlite (por defecto `<repo>/.data/pglite`). `memory://` = base efímera |
| `NODARA_UPLOAD_DIR` | No | Dónde se guardan los archivos subidos (por defecto `<repo>/.data/uploads`) |
| `NODARA_COOKIE_SECURE` | No | `1` fuerza `Secure` en la cookie de sesión (útil tras un proxy HTTPS sin `X-Forwarded-Proto`) |
| `NODARA_VERSION_INTERVAL_MS` | No | Intervalo mínimo entre versiones automáticas del historial (por defecto 10 min) |
| `PORT` / `HOSTNAME` | No | Puerto y dirección de escucha de `next start` |

\* Obligatoria en producción con varias personas: PGlite es un solo proceso y no admite varias instancias.

Las pruebas usan además `NODARA_E2E`, `NODARA_E2E_TOKEN` y `DATABASE_URL_TEST`; **nunca** deben definirse en producción (`/api/test/reset` solo existe con `NODARA_E2E=1`).

## 1. Docker Compose (recomendado)
```bash
git clone <repositorio> nodara && cd nodara
cp deploy/.env.example .env      # edita POSTGRES_PASSWORD (larga y aleatoria)
docker compose up -d --build
curl http://localhost:3000/api/health   # {"status":"ok"}
```
- Las migraciones se aplican solas al arrancar.
- Volúmenes: `pgdata` (base de datos) y `uploads` (archivos). **Respáldalos** (ver «Copias de seguridad»).
- Abre `http://localhost:3000` y crea la primera cuenta: adopta el espacio de trabajo y se convierte en propietaria.
- Pon un proxy HTTPS delante y define `NODARA_COOKIE_SECURE=1`.

## 2. Instalación directa (systemd)
```bash
sudo useradd -r -m -d /opt/nodara nodara
sudo -u nodara git clone <repositorio> /opt/nodara
cd /opt/nodara/app && sudo -u nodara npm ci && sudo -u nodara npm run build
sudo install -m 600 /dev/null /etc/nodara.env   # DATABASE_URL, NODARA_UPLOAD_DIR=/var/lib/nodara/uploads, NODARA_COOKIE_SECURE=1
sudo cp /opt/nodara/deploy/nodara.service.example /etc/systemd/system/nodara.service
sudo systemctl enable --now nodara
```
Crea antes el rol y la base: `CREATE ROLE nodara LOGIN PASSWORD '…'; CREATE DATABASE nodara OWNER nodara;`.

## 3. Proxy inverso y HTTPS
Usa `deploy/nginx.conf.example` como base. Puntos críticos:
1. **SSE sin buffering** en `/api/collab/<id>/stream` (`proxy_buffering off`, `proxy_read_timeout 1h`). Sin esto la edición en tiempo real se retrasa o se corta.
2. Reenviar `Host` / `X-Forwarded-Host` / `X-Forwarded-Proto`: la protección CSRF compara `Origin` con el host y las cookies seguras dependen del protocolo.
3. `client_max_body_size 25m` (el límite de subida de Nodara es 20 MB).

## 4. Modo local con PGlite
```powershell
.\scripts\setup.ps1 ; .\scripts\dev.ps1     # Windows (Node portable incluido)
```
o, en cualquier sistema: `cd app && npm ci && npm run build && npx next start`. Los datos quedan en `.data/`. Para pasar a PostgreSQL: `scripts/setup-postgres.ps1` y `scripts/migrate-to-postgres.ps1` (copia verificada, con respaldo previo).

## Copias de seguridad y restauración
- **PostgreSQL**: `pg_dump -Fc nodara > nodara.dump` / `pg_restore -d nodara --clean nodara.dump`. En Windows: `scripts/db-backup.ps1` y `scripts/db-restore.ps1`.
- **Archivos subidos**: copia el volumen/carpeta de `NODARA_UPLOAD_DIR`.
- **Exportación lógica**: *Configuración → Espacio de trabajo → Exportar* descarga un JSON con páginas y bases (sin papelera ni archivos). Es un complemento, no sustituye al volcado de la base.
- Prueba la restauración en un entorno aparte antes de necesitarla.

## Actualizaciones
```bash
git pull && docker compose up -d --build     # o: npm ci && npm run build && systemctl restart nodara
```
Las migraciones (`app/drizzle/*.sql`) se aplican al arrancar y son aditivas. Haz un respaldo antes de actualizar.

## Seguridad en producción (lista de comprobación)
- [ ] HTTPS activo y `NODARA_COOKIE_SECURE=1`.
- [ ] Contraseñas de PostgreSQL únicas; el puerto 5432 **no** expuesto a Internet.
- [ ] Ninguna variable `NODARA_E2E*` definida.
- [ ] Respaldos automáticos probados.
- [ ] `/api/health` conectado al monitor de disponibilidad.
- [ ] Solo una instancia de la aplicación (ver límites).
Más detalle en [`SECURITY.md`](SECURITY.md).

## Límites conocidos
- **Una instancia**: las salas de edición colaborativa y los límites de intentos viven en memoria del proceso. Para escalar horizontalmente haría falta un bus compartido (Redis/NOTIFY), no implementado.
- **Sin correo**: no hay envío de emails; las invitaciones y el restablecimiento de contraseña se hacen con enlaces de un solo uso que copia un administrador.
- Los archivos subidos se guardan en disco local (no hay almacenamiento S3).
