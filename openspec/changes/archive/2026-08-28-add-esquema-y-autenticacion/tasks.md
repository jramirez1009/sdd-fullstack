## 1. Estructura del proyecto y configuración

- [x] 1.1 Crear `backend/` con `package.json` (tipo módulo ES, script `dev` con `--watch`) e instalar `express`, `pg`, `bcrypt`, `jsonwebtoken`, `dotenv` y `cors`; verificar que `npm install` termina sin errores y que `node -e "import('express')"` resuelve
- [x] 1.2 Añadir `.gitignore` en la raíz que excluya `node_modules/` y `.env`; verificar con `git status --ignored` que `.env` no aparece como archivo a versionar
- [x] 1.3 Crear `backend/.env.example` documentando `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRACION` y `PORT` sin credenciales reales; verificar que el archivo no contiene ningún valor de conexión ni secreto real
- [x] 1.4 Crear `backend/src/config/env.js` que cargue las variables con `dotenv` y aborte el arranque si falta `DATABASE_URL` o si `JWT_SECRET` falta o mide menos de 32 caracteres; verificar arrancando con un `.env` incompleto y comprobando que el proceso termina con un mensaje claro y código de salida distinto de cero
- [x] 1.5 Crear `backend/src/config/bd.js` con un único `Pool` de `pg` con `ssl` habilitado y máximo de conexiones conservador; verificar con un script puntual que `SELECT 1` responde contra la base de Supabase

## 2. Esquema de base de datos

- [x] 2.1 Escribir `backend/bd/schema.sql` con la extensión `citext` y las tablas `usuarios` (incluida la columna `nombre` anulable), `categorias`, `etiquetas`, `tareas` (con `titulo`, `descripcion`, `estado`, `prioridad`, `fecha_vencimiento`, `creado_en`, `actualizado_en` y `completada_en`) y `tarea_etiquetas`, todas con `CREATE TABLE IF NOT EXISTS`, sus claves foráneas y las reglas de borrado del diseño (cascada hacia `usuarios`, `SET NULL` en `tareas.categoria_id`, cascada por ambos lados en `tarea_etiquetas`); verificar que el archivo se ejecuta completo sin error contra `DATABASE_URL`
- [x] 2.2 Añadir al esquema las restricciones de integridad: `UNIQUE` sobre `usuarios.email` de tipo `CITEXT`, `UNIQUE (usuario_id, nombre)` en `categorias` y `etiquetas` con `nombre` de tipo `CITEXT`, clave primaria compuesta en `tarea_etiquetas`, `NOT NULL` en toda columna obligatoria, `DEFAULT` y `CHECK` en `tareas.estado` y `tareas.prioridad`, y `CHECK` de longitud en `usuarios.nombre`, `tareas.titulo` y `tareas.descripcion`; verificar consultando `information_schema.table_constraints` que cada restricción existe
- [x] 2.3 Añadir los índices de `tareas` sobre `(usuario_id, estado)`, `(usuario_id, categoria_id)`, `(usuario_id, prioridad)` y `(usuario_id, fecha_vencimiento)`, y el índice de `tarea_etiquetas (etiqueta_id)`, todos con `IF NOT EXISTS`; verificar con `\di` o consultando `pg_indexes` que los cinco están creados
- [x] 2.4 Añadir al final de `schema.sql` las sentencias `DROP TABLE` en orden inverso de dependencia, comentadas, como procedimiento de reversión documentado; verificar que el archivo sigue ejecutándose sin efecto destructivo
- [x] 2.5 Reejecutar `schema.sql` completo una segunda vez sobre la misma base y verificar que termina sin error y sin duplicar objetos (idempotencia)
- [x] 2.6 Verificar las reglas de borrado con datos de prueba desechables: al borrar un usuario desaparecen sus categorías, etiquetas, tareas y vínculos; al borrar una categoría sus tareas siguen existiendo con `categoria_id` a `NULL`; al borrar una tarea o una etiqueta solo desaparecen sus vínculos. Eliminar los datos de prueba al terminar
- [x] 2.7 Verificar la insensibilidad a mayúsculas con datos de prueba desechables: insertar `ana@ejemplo.com` y comprobar que `Ana@Ejemplo.com` es rechazado por la restricción `UNIQUE`, y que lo mismo ocurre con dos categorías "Trabajo" y "trabajo" del mismo usuario mientras que sí se admiten en usuarios distintos. Eliminar los datos de prueba al terminar
- [x] 2.8 Añadir el disparador `BEFORE UPDATE` que mantiene `tareas.actualizado_en`; verificar con datos de prueba desechables que modificar una fila cambia ese valor sin que la sentencia lo asigne, y eliminarlos al terminar

## 3. Servidor HTTP y manejo de errores

- [x] 3.1 Crear `backend/src/app.js` con la instancia de Express, `express.json()`, `cors` y el montaje de rutas, y `backend/src/server.js` que la arranca en `PORT`; verificar que `npm run dev` levanta el servidor y responde a una petición a una ruta inexistente
- [x] 3.2 Crear `backend/src/utils/errores.js` con una clase de error de aplicación que lleve código HTTP y código de error de negocio; verificar que un error lanzado desde un controlador de prueba llega al middleware con ambos datos
- [x] 3.3 Crear el middleware de manejo de errores final que responde `{ error: { codigo, mensaje } }` con `codigo` estable en mayúsculas (`DATOS_INVALIDOS`, `EMAIL_DUPLICADO`, `CREDENCIALES_INVALIDAS`, `NO_AUTENTICADO`, `NO_ENCONTRADO`, `ERROR_INTERNO`) y `mensaje` en español, traduce los errores de aplicación a su estado HTTP y convierte cualquier otro en `500` con mensaje genérico, registrando el detalle solo en el servidor; verificar provocando un error no controlado que la respuesta no contiene traza de pila ni mensaje del driver de base de datos
- [x] 3.4 Añadir el manejador de rutas no encontradas que responde `404` con el mismo formato de error; verificar con una petición a `/api/no-existe`

## 4. Registro de usuario

- [x] 4.1 Crear `backend/src/utils/validacion.js` con la validación de email, de contraseña (entre 8 y 72 bytes en UTF-8, sin reglas de composición) y de nombre opcional (1 a 100 caracteres si viene); verificar con casos de email sin arroba, campos ausentes, contraseña de 7 caracteres, contraseña de 73 bytes y nombre vacío que cada uno se rechaza
- [x] 4.2 Crear `backend/src/utils/password.js` con las funciones de hash y de comparación sobre `bcrypt` con coste 10; verificar que el hash de una contraseña no coincide con su texto plano y que la comparación devuelve verdadero solo con la contraseña correcta
- [x] 4.3 Crear `backend/src/repositorios/usuariosRepo.js` con consultas parametrizadas para insertar un usuario y para buscarlo por email; la consulta de inserción devuelve solo `id, email, nombre, creado_en` y la de búsqueda por email es la única que trae `password_hash`. Verificar por inspección que ninguna consulta concatena valores en la cadena SQL
- [x] 4.4 Implementar `POST /api/auth/registro` (controlador y ruta) que valida la entrada, hashea la contraseña e inserta el usuario, respondiendo `201` con `id`, `email` y `nombre`; verificar con una petición con nombre y otra sin él que ambas responden `201`, que la segunda deja el nombre vacío y que ninguna respuesta contiene campo de contraseña
- [x] 4.5 Traducir el error `23505` de PostgreSQL a una respuesta `409` sin revelar detalles del almacenamiento; verificar registrando dos veces el mismo email y comprobando que la segunda responde `409` y que sigue existiendo un solo usuario
- [x] 4.6 Verificar que el registro con datos inválidos (email mal formado, contraseña corta, campos ausentes) responde `400` indicando los campos inválidos

## 5. Login y emisión de JWT

- [x] 5.1 Crear `backend/src/utils/jwt.js` con la emisión de un token `HS256` que lleve el identificador y el email del usuario y expire según `JWT_EXPIRACION`, y con su verificación; verificar decodificando un token emitido que contiene esos datos y una expiración futura
- [x] 5.2 Implementar `POST /api/auth/login` que valida la entrada, busca al usuario por email, compara la contraseña y devuelve `200` con `{ token, usuario }`; verificar con credenciales correctas que la respuesta trae un token utilizable y los datos públicos del usuario
- [x] 5.3 Hacer que el email inexistente y la contraseña incorrecta produzcan la misma respuesta `401` con idéntico mensaje genérico; verificar comparando ambas respuestas byte a byte y comprobando que ninguna revela si el email existe
- [x] 5.4 Verificar que el login sin email o sin contraseña responde `400` y que la respuesta de login nunca incluye el hash de contraseña

## 6. Middleware de autenticación y perfil

- [x] 6.1 Crear `backend/src/middleware/autenticacion.js` que extrae el token de la cabecera `Authorization: Bearer <token>`, lo verifica y deja la identidad en `req.usuario`, respondiendo `401` en cualquier fallo sin ejecutar el manejador siguiente; verificar los cuatro casos: sin cabecera, cabecera mal formada, firma inválida y token expirado
- [x] 6.2 Implementar `GET /api/auth/perfil` protegido por ese middleware, devolviendo `id`, `email`, `nombre` y `creado_en` del usuario del token consultados por el repositorio; verificar con un token válido que responde `200` con esos cuatro campos y ninguno más
- [x] 6.3 Verificar el aislamiento entre usuarios: registrar dos usuarios, obtener el token de cada uno y comprobar que cada perfil devuelve solo los datos de su propio dueño
- [x] 6.4 Verificar que `GET /api/auth/perfil` sin token, con token manipulado y con token expirado responde `401` en los tres casos y no devuelve ningún dato de usuario

## 7. Verificación integral del cambio

- [x] 7.1 Recorrer el flujo completo contra el servidor en marcha —registro, login, perfil con el token obtenido— y verificar que cada paso responde con el estado esperado del spec de autenticación
- [x] 7.2 Revisar el cuerpo de todas las respuestas producidas en 7.1, incluidas las de error, y verificar que en ninguna aparece el hash de contraseña ni detalle interno alguno
- [x] 7.3 Auditar `backend/src/` y verificar que todo el SQL vive en `src/repositorios/`, que ninguna consulta concatena valores y que todas usan marcadores de parámetro
- [x] 7.5 Verificar que toda respuesta de error producida durante la comprobación trae un `codigo` estable en mayúsculas y un `mensaje` en español, y que ningún código depende del texto del mensaje
- [x] 7.4 Ejecutar `openspec validate add-esquema-y-autenticacion --strict` y verificar que pasa sin errores
