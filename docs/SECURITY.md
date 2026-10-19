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

Pendiente: verificación de correo y restablecimiento de contraseña (requieren envío de correo), 2FA, registro de auditoría, límite de tamaño de peticiones JSON.
