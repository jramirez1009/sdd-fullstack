## Context

Ver proposal.md - Why. El estado actual: la tabla `usuarios` tiene identificador, email, hash de contraseña, nombre y fecha de alta; no hay ningún campo de actividad. La base vive en Supabase, ya creada y poblada por el autor (ver context del proyecto); cualquier cambio de esquema debe poder aplicarse sobre esa base ya existente sin recrearla y sin ORM: SQL parametrizado directo vía `pg`.

## Goals / Non-Goals

**Goals:**
- Añadir `usuarios.ultimo_login` y actualizarlo en cada login exitoso, dejando el dato disponible para la futura consulta de "usuarios activos en los últimos 7 días".
- Que el registro del login no pueda romper ni ralentizar de forma perceptible el propio login.

**Non-Goals:**
- No se implementa la consulta de inteligencia de negocio en este cambio.
- No se añade índice sobre `ultimo_login` todavía (ver Decisiones).
- No se decide en este cambio si el perfil muestra el dato en el frontend; la spec lo deja opcional.

## Decisions

- **Columna `ultimo_login TIMESTAMPTZ NULL` en `usuarios`.** `TIMESTAMPTZ` por coherencia con el resto de marcas temporales del esquema (creación, modificación, finalización de tarea) y para comparar sin ambigüedad con `now()`. Nullable y sin `DEFAULT`: un alta no implica login, y `NULL` distingue "nunca inició sesión" de cualquier fecha real. Alternativa descartada: `DEFAULT now()` en el alta — mentiría sobre la actividad y contaminaría la pregunta 8.
- **La actualización se hace en el manejador de `POST /api/auth/login`, tras verificar la contraseña, con `UPDATE usuarios SET ultimo_login = now() WHERE id = $1`.** Sentencia parametrizada, una sola fila por id. Se ejecuta después de haber resuelto que las credenciales son válidas, de modo que un 401 nunca llega a este punto.
- **La escritura de `ultimo_login` no bloquea la respuesta de login ante fallo.** Si ese `UPDATE` falla (p. ej. problema transitorio de BD) se registra en el log del servidor pero el login sigue devolviendo `200` con su JWT: el efecto es secundario y la identidad ya está establecida. Alternativa descartada: envolver emisión de token y update en una transacción — encadenaría el éxito del login a un dato accesorio.
- **Sin índice sobre `ultimo_login` por ahora.** El volumen de usuarios del reto es pequeño y no hay todavía consulta que lo use. Cuando se implemente la pregunta 8 se añadirá el índice en ese cambio, junto a la consulta que lo justifica (regla de `design`: todo índice se motiva por una consulta concreta).
- **Registro automático tras alta:** si el flujo de `POST /api/auth/registro` llama internamente a la misma ruta de login, hereda el `UPDATE` sin código adicional. No se añade una escritura de `ultimo_login` separada en el alta.

## Risks / Trade-offs

- [Una escritura por login añade una consulta a un endpoint caliente] → Es un `UPDATE` por clave primaria, coste despreciable frente al hash de contraseña que ya hace el login.
- [La migración corre sobre una base compartida ya poblada] → `ALTER TABLE usuarios ADD COLUMN ultimo_login TIMESTAMPTZ` es no destructivo y rápido (columna nullable, sin reescritura de filas en PostgreSQL). Se refleja también en `schema.sql` para mantenerlo como documentación reproducible.
- [Filtrado de datos entre usuarios] → El único punto de exposición permitido es `GET /api/auth/perfil` sobre el propio token; ninguna consulta de listado o agregación incluye la columna.

## Migration Plan

1. Añadir la columna a `schema.sql` (definición canónica del esquema).
2. Aplicar sobre la base de Supabase: `ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_login TIMESTAMPTZ;` (las filas existentes quedan con `NULL`, que es el estado correcto).
3. Desplegar el cambio de la API que hace el `UPDATE` en el login.
4. Rollback: revertir el código de la API; la columna puede quedarse (inerte) o eliminarse con `ALTER TABLE usuarios DROP COLUMN ultimo_login;` si se desea limpieza total.
