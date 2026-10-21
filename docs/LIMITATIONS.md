# Limitaciones conocidas

Este documento reúne en un solo lugar lo que Nodara **no** hace todavía. Los planes están en [`ROADMAP.md`](ROADMAP.md).

## Arquitectura y escalado
- **Una sola instancia de la aplicación.** Las salas de edición colaborativa y los límites de intentos de inicio de sesión viven en la memoria del proceso. Para escalar en horizontal haría falta un bus compartido (Redis o `LISTEN/NOTIFY`), que no está implementado.
- **Archivos en disco local.** No hay almacenamiento S3 ni compatible, ni escaneo antivirus de lo que se sube.
- **Sin límite global de tamaño de peticiones JSON.** Solo las subidas (20 MB) y las importaciones (5 MB) tienen tope.

## Cuentas y correo
- **No hay envío de correo.** Sin verificación de correo, sin restablecimiento autoservicio de contraseña y sin notificaciones por email. Las invitaciones y el restablecimiento se hacen con enlaces de un solo uso que copia un administrador.
- **Sin 2FA ni SSO** (OIDC/SAML/SCIM).

## Editor
- Sin bloques sincronizados ni botones.
- Los comentarios necesitan texto seleccionado (salvo los comentarios de página).
- Los marcadores web no muestran vista previa del sitio: no se descargan metadatos para evitar SSRF.
- Las imágenes se redimensionan por porcentaje del ancho disponible.
- No se importan exportaciones `.zip` de Notion.

## Bases de datos
- Sin vistas vinculadas entre bases, sin «última edición por», sin color condicional.
- Sin vistas de gráfico, feed ni mapa.
- Las barras del cronograma no se pueden arrastrar ni redimensionar; el calendario es solo mensual.
- Sin agrupación por intervalos de fecha.
- La vista de tabla carga las filas por bloques de 100 («Mostrar más filas»); las demás vistas pintan todas las filas a la vez.
- Las propiedades «Persona» guardan ids de usuario sin comprobar que sean miembros del espacio al escribir (se muestran como «Desconocido» si no lo son).

## Pruebas y verificación
- Las pruebas de rendimiento usan presupuestos amplios porque la carga de la máquina varía; no sustituyen a un perfilado en producción.
- Los E2E corren con un solo worker sobre un build de producción y una base desechable; no se han ejecutado contra PostgreSQL real (el driver `pg` se prueba contra un servidor con protocolo Postgres).
- La suite no incluye pruebas de carga con muchas personas editando a la vez.
- `npm audit --omit=dev` da 0 vulnerabilidades; quedan avisos solo en dependencias de **desarrollo** (cadena de ESLint y servidor de desarrollo de esbuild/drizzle-kit), que no van en la imagen de producción.
