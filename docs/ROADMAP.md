# Roadmap

- [x] **Hito 1** — Shell, sidebar, páginas anidadas, título autoguardado, favoritos, papelera, API.
- [x] **Hito 2** — Editor de bloques (TipTap): menú `/`, atajos, formato flotante, asa de bloque, colores, enlaces, tablas.
- [x] **Hito 3** — Mover/reordenar (dnd-kit), búsqueda, duplicar, iconos, menú contextual, tema oscuro.
- [x] **Hito 4** — Bases de datos: propiedades, filtros, orden, agrupación, cálculos, seis vistas, plantillas, bases integradas; PostgreSQL con driver dual (pg/PGlite).
- [x] **Hito 5** — Usuarios, sesiones, espacios de trabajo, roles, invitaciones, permisos por página, compartir, enlaces públicos, historial de versiones.
- [x] **Hito 6** — Colaboración en tiempo real (Yjs sobre SSE), presencia y cursores, modo sin conexión, comentarios anclados, menciones, bandeja de entrada.
- [x] **Hito 7** — Editor completo (llamadas, columnas, imágenes, archivos, marcadores, ecuaciones, índice, código con resaltado), búsqueda avanzada, importación/exportación, plantillas de página, portada y estilos de página, bloqueo, auditoría, analíticas, restablecimiento de contraseña, ventana lateral, personas, responsive, accesibilidad (axe, WCAG AA), rendimiento, despliegue (Docker, nginx, systemd) y documentación pública.

## Siguientes pasos (no iniciados)
- **Escalado horizontal**: bus compartido (Redis o `LISTEN/NOTIFY`) para las salas colaborativas y los límites de intentos.
- **Correo saliente**: SMTP para verificación de correo, restablecimiento autoservicio y notificaciones por email.
- **Almacenamiento de archivos** en S3/compatible; antivirus opcional.
- **Bases de datos**: vistas vinculadas, «última edición por», color condicional, gráficos, fórmulas con más funciones, barras de cronograma arrastrables.
- **Editor**: bloques sincronizados, botones, comentarios en bloques sin selección de texto, importación de Notion (.zip).
- **Cuentas**: 2FA, SSO (OIDC/SAML), SCIM.
- **Regresión visual automatizada** contra capturas de referencia de Notion (hoy la comparación es medida por scripts, no por diferencia de píxeles).
