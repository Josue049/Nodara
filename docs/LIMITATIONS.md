# Limitaciones conocidas

Estado: 2026-10-19, tras el Hito 7. Este documento reúne en un solo lugar lo que Nodara **no** hace todavía o no se ha podido comprobar. El estado general y los resultados de las pruebas están en [`STATUS.md`](STATUS.md); los planes, en [`ROADMAP.md`](ROADMAP.md).

## Pendiente de una acción humana
| Qué | Por qué | Cómo se resuelve |
|---|---|---|
| PostgreSQL local sin configurar | Falta la contraseña del superusuario `postgres` y no se debe adivinar | Ejecutar `.\scripts\setup-postgres.ps1` y luego `.\scripts\migrate-to-postgres.ps1` (ver [`DATABASE.md`](DATABASE.md)). Hasta entonces se usa PGlite |
| Despliegue con Docker sin probar | Docker no está instalado en la máquina de desarrollo | Probar `docker compose up -d --build` en una máquina con Docker (ver [`DEPLOYMENT.md`](DEPLOYMENT.md)) |
| Fila de prueba en Notion | Una inserción de texto accidental dejó la fila «Columna unoBloques (prueba)» en la base «Investigación Nodara (prueba)» | Borrarla a mano (opcional; no afecta a Nodara). Ver `research/features/005-notion-blocks.md` |

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

## Fidelidad con Notion
- **Medido y coincidente:** barra lateral, tipografía y colores (26/26), tabla (20/20) en claro y oscuro, y la caja del callout y el divisor.
- **Sin medir (hipótesis):** separación de columnas, ecuaciones, tabla de contenidos, marcador, barra de acciones de la imagen, colores de callout distintos del gris, estados hover/activo y bordes del tema claro.
- **Diferencias deliberadas por accesibilidad (WCAG AA):** texto terciario más oscuro, acento azul más oscuro en el tema claro (`#1a6fc4` en lugar de `#2383e2`), encabezado de tabla `#726f6a` en lugar de `#7d7a75` y rojo de error `#c9302c`.
- **Apertura de registros:** Notion usa ventana lateral por defecto; Nodara ofrece ventana lateral o página completa por vista y abre página completa por defecto.
- **Sin regresión visual por píxeles:** la comparación con Notion se hace por medidas de estilo (scripts con Playwright/CDP), no por diferencia automatizada de capturas.
- **Medición en Notion limitada:** la inserción automática de bloques en Notion resultó frágil (el menú `/` filtra por nombre localizado y la ventana lateral se cierra entre ejecuciones), por lo que solo se midió lo que quedó insertado.
- Las funciones de planes de pago (auditoría, analíticas, bloqueo, colaboración) son diseño propio; no se observaron en Notion.

## Pruebas y verificación
- Las pruebas de rendimiento usan presupuestos amplios porque la carga de la máquina varía; no sustituyen a un perfilado en producción.
- Los E2E corren con un solo worker sobre un build de producción y una base desechable; no se han ejecutado contra PostgreSQL real (el driver `pg` se prueba contra un servidor con protocolo Postgres).
- La suite no incluye pruebas de carga con muchas personas editando a la vez.
- `npm audit --omit=dev` da 0 vulnerabilidades; quedan avisos solo en dependencias de **desarrollo** (cadena de ESLint y servidor de desarrollo de esbuild/drizzle-kit), que no van en la imagen de producción.
