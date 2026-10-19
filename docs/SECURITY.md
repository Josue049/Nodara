# Seguridad

- **Contraseñas**: scrypt (N=16384, r=8, p=1) con sal aleatoria por usuario; comparación en tiempo constante. Mínimo 8 caracteres.
- **Sesiones**: token aleatorio de 256 bits en cookie `nodara_session` (`HttpOnly`, `SameSite=Lax`, `Secure` bajo HTTPS o con `NODARA_COOKIE_SECURE=1`). La base solo guarda el hash SHA-256 del token. Duración 30 días con renovación deslizante. Cambiar la contraseña cierra las demás sesiones.
- **Inicio de sesión**: mismo mensaje y coste exista o no la cuenta; máximo 8 intentos por IP+correo cada 10 minutos (HTTP 429). Registro limitado por IP.
- **CSRF**: toda petición que modifica datos con cabecera `Origin` de otro host se rechaza (403) además de `SameSite=Lax`.
- **Autorización** (`src/server/authz.ts`): cada ruta verifica el nivel sobre la página (`view < comment < edit < full`). Si no hay acceso, la respuesta es 404 (no revela que existe). Niveles = creador (completo) ∪ permisos explícitos heredados por el árbol ∪ alcance «Espacio de equipo» según el rol (propietario/administrador: completo; miembro: edición; invitado: nada). Los registros de bases de datos heredan de su página anfitriona.
- **Roles de espacio**: propietario, administrador, miembro, invitado. Siempre queda al menos un propietario; los administradores no gestionan propietarios; los invitados no ven correos ajenos, no crean páginas raíz ni comparten.
- **Invitaciones**: token de un solo uso (hash en base), caducan a los 14 días, no degradan a quien ya es miembro. Sin verificación de correo todavía: el enlace es la prueba de posesión.
- **Enlaces públicos**: token en la URL; cubren solo el subárbol publicado; no abren la API privada. Nivel `view`, `comment` o `edit`.
- **Archivos**: solo descargables por miembros del espacio al que pertenecen; `X-Content-Type-Options: nosniff`; tipos desconocidos se sirven como descarga.
- **Pruebas**: `/api/test/reset` solo existe con `NODARA_E2E=1` + token aleatorio por ejecución + base desechable.

- **Restablecimiento de contraseña**: un propietario/administrador genera un enlace de un solo uso (hash en base, caduca en 1 hora, un enlace vigente por persona). Al usarlo se cierran todas las sesiones de la cuenta. Un administrador no restablece a propietarios ni a sí mismo. Limitado por IP.
- **Auditoría**: `audit_log` registra compartir, permisos, alcance, publicar, bloquear, exportar, eliminar, restaurar versión, invitaciones, cambios de rol y restablecimientos; visible solo para propietarios/administradores y exportable a CSV (con neutralización de fórmulas).
- **Cabeceras**: CSP (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`; `unsafe-inline` solo por los scripts/estilos en línea de Next.js), `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP; sin `X-Powered-By`.
- **Entradas**: validación con Zod en todas las rutas; límite de 20 MB en subidas y 5 MB en importaciones; URLs de imágenes/enlaces/portadas solo `http(s)` o `/api/files/` (nunca `javascript:`); KaTeX con `trust:false`; resaltado de búsqueda sin HTML (se pinta como nodos de React).
- **Páginas bloqueadas**: el servidor degrada el nivel efectivo a «comentar»; vale también para la edición colaborativa y los enlaces públicos.
- **Enlaces públicos**: no revelan la lista de miembros del espacio (propiedades «Persona»).
- **Verificación continua** (`tests/e2e/17-security-sweep.spec.ts`): todas las operaciones con sesión devuelven 401 sin ella (el barrido lee los `route.ts`, así que una ruta nueva entra sola); Más de 40 intentos de acceso cruzado (IDOR) entre espacios no obtienen ningún 2xx; cookies HttpOnly/SameSite; Origin ajeno rechazado; descargas con `nosniff` y HTML/SVG como adjunto; reinicio de pruebas inaccesible sin token.
- **Dependencias**: `npm audit --omit=dev` → 0 vulnerabilidades (KaTeX 0.19). Quedan avisos solo en dependencias de **desarrollo** (cadena de ESLint y servidor de desarrollo de esbuild/drizzle-kit); no se incluyen en la imagen de producción.

## Pendiente
Verificación de correo y restablecimiento autoservicio (requieren SMTP), 2FA/SSO, límite de tamaño de peticiones JSON a nivel de servidor (hoy solo subidas e importaciones), almacenamiento de límites de intentos compartido entre instancias, escaneo antivirus de archivos subidos.
