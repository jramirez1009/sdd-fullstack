## 1. Esquema de base de datos

- [x] 1.1 Añadir la columna `ultimo_login TIMESTAMPTZ` (nullable, sin DEFAULT) a la definición de `usuarios` en `schema.sql`; verificar que el archivo describe la columna y que un `psql` con `schema.sql` sobre una base vacía la crea.
- [x] 1.2 Aplicar sobre la base de Supabase existente `ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_login TIMESTAMPTZ;`; verificar con `\d usuarios` (o consulta a `information_schema.columns`) que la columna existe y que los usuarios previos tienen `ultimo_login` a NULL.

## 2. Comportamiento del login

- [x] 2.1 En el manejador de `POST /api/auth/login`, tras verificar la contraseña con éxito y antes de responder, ejecutar `UPDATE usuarios SET ultimo_login = now() WHERE id = $1` con consulta parametrizada; verificar manualmente que un login correcto deja `ultimo_login` con la marca de tiempo de la petición.
- [x] 2.2 Envolver ese `UPDATE` de modo que un fallo se registre en el log del servidor pero no altere la respuesta del login (sigue devolviendo `200` y el JWT); verificar simulando un error de la consulta que el login responde igualmente con token.
- [x] 2.3 Confirmar que un login con contraseña incorrecta (respuesta `401`) no ejecuta el `UPDATE`; verificar que `ultimo_login` no cambia tras un intento fallido sobre un email registrado.

## 3. Exposición en el perfil (opcional)

- [x] 3.1 Decidir si `GET /api/auth/perfil` incluye `ultimo_login` en su DTO; si se incluye, mapear NULL a valor vacío y verificar que la respuesta del perfil de un usuario sin logins previos muestra el campo vacío y la de uno con login muestra su instante.
- [x] 3.2 Verificar que ninguna otra consulta de listado o agregación de usuarios selecciona `ultimo_login` (revisión de las consultas SQL del backend).

## 4. Verificación de comportamiento

- [x] 4.1 Prueba de extremo a extremo: registrar un usuario, comprobar `ultimo_login` NULL; iniciar sesión, comprobar que se fija; volver a iniciar sesión, comprobar que avanza al nuevo instante y no conserva el anterior.
- [x] 4.2 Ejecutar `openspec validate add-registro-ultimo-login --strict` y confirmar que pasa.
