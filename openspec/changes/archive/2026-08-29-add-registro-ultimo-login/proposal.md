## Why

El esquema actual solo registra cuándo un usuario se dio de alta (`fecha de alta`), pero no cuándo inició sesión por última vez. La pregunta 8 de inteligencia de negocio del reto pide definir "usuario activo" por login reciente y responder cuántos usuarios estuvieron activos en los últimos 7 días; sin registrar el último login, esa pregunta no tiene ningún dato que la sustente y no puede responderse de forma honesta.

## What Changes

- **2026-08-29**: La tabla `usuarios` gana una columna `ultimo_login` (marca de tiempo con zona horaria, admite nulo). Nulo es el estado correcto para un usuario que nunca ha vuelto a iniciar sesión tras registrarse; no se inventa una fecha.
- Cada inicio de sesión exitoso (`POST /api/auth/login`, tras validar email y contraseña) actualiza `ultimo_login` al instante actual. Un intento fallido (email o contraseña incorrectos) NO la modifica.
- El registro (`POST /api/auth/registro`) no fija `ultimo_login` por sí solo. Si el flujo de registro inicia sesión automáticamente tras crear la cuenta, ese login cuenta como cualquier otro y sí la actualiza.
- `ultimo_login` nunca se expone junto a datos de otros usuarios. Solo puede aparecer en el perfil propio del usuario autenticado (`GET /api/auth/perfil`), y su inclusión ahí es opcional.
- No es un cambio de contrato con ruptura: la columna es nullable y ningún endpoint existente cambia su forma de respuesta de manera obligatoria.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `esquema-datos`: se añade el requisito de registrar el instante del último inicio de sesión exitoso de cada usuario, con nulo como estado válido mientras no haya habido ninguno.
- `autenticacion`: el inicio de sesión exitoso pasa a tener como efecto adicional la actualización del último login del usuario; el login fallido no lo altera. El perfil propio puede exponer ese dato.

## Impact

- Base de datos: nueva columna `ultimo_login` en `usuarios` (`schema.sql`, más migración sobre la base de Supabase ya existente).
- API: lógica añadida en el manejador de `POST /api/auth/login`; opcionalmente el DTO público de `GET /api/auth/perfil`.
- Habilita, más adelante, la consulta de inteligencia de negocio de "usuarios activos en los últimos 7 días" (fuera del alcance de este cambio).
- Fuera de alcance: sesiones múltiples o por dispositivo, expiración por inactividad, e historial de accesos (solo se guarda el último, no todos).
