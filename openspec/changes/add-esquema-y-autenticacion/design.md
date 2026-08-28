## Context

Ver `proposal.md — Why` para la motivación. Estado actual: el repositorio solo contiene la configuración de OpenSpec; no hay código de aplicación, ni `package.json`, ni tablas creadas. Este cambio establece a la vez la estructura del backend y el esquema de la base de datos.

Restricciones que condicionan el diseño:

- La base de datos PostgreSQL vive en Supabase, ya creada, y se comparte vía `DATABASE_URL`. El DDL se ejecuta una sola vez contra esa instancia; no hay entorno local por desarrollador ni herramienta de migraciones.
- Acceso a datos con SQL parametrizado directo sobre el driver `pg`. Sin ORM.
- Nombres de tablas, columnas, rutas y recursos en español.
- Todo endpoint protegido se identifica exclusivamente por JWT; no hay estado de sesión en el servidor.

Los requisitos que este diseño debe satisfacer están en `specs/esquema-datos/spec.md` y `specs/autenticacion/spec.md`.

## Goals / Non-Goals

**Goals:**

- Un `schema.sql` idempotente y legible que cree las cinco tablas con integridad referencial completa y los índices que sostendrán el filtrado y las consultas de inteligencia de negocio de los cambios posteriores.
- Una estructura de backend por capas (rutas → controladores → repositorios de datos) que los cambios siguientes puedan extender sin reorganizar nada.
- Un middleware de autenticación reutilizable que sea el único punto donde se verifica un JWT en todo el sistema.
- Que la separación entre datos de usuarios distintos esté cimentada en el esquema desde el primer día, aunque su aplicación a nivel de consulta llegue con los endpoints de negocio.

**Non-Goals:**

- Herramienta de migraciones versionadas. Un único `schema.sql` cubre la vida del entregable.
- Refresh tokens, revocación de tokens o lista de tokens invalidados.
- Roles, permisos o compartición de datos entre usuarios.
- Endpoints de negocio, aunque sus tablas se creen aquí.
- Pruebas automatizadas de la capa HTTP; la verificación de este cambio se hace con peticiones manuales documentadas en `tasks.md`.

## Decisions

### Estructura de carpetas: `backend/` y `frontend/` como raíces separadas

El repositorio se organiza como dos proyectos npm independientes bajo `backend/` y `frontend/`, cada uno con su `package.json`. Dentro del backend: `src/config/` (conexión y variables de entorno), `src/rutas/`, `src/controladores/`, `src/repositorios/` (todo el SQL vive aquí y en ningún otro sitio), `src/middleware/`, `src/utils/`, y `bd/schema.sql`.

Alternativa descartada: un único `package.json` en la raíz con workspaces. Añade una capa de herramientas que el evaluador tendría que entender, y el reto no comparte código entre backend y frontend.

La regla "todo el SQL vive en `src/repositorios/`" es la que hace verificable el principio de consultas parametrizadas: basta auditar una carpeta para comprobar que no se concatena SQL.

### Identificadores: `BIGINT GENERATED ALWAYS AS IDENTITY`

Claves primarias enteras autogeneradas, no UUID. Motivo: los índices sobre las claves foráneas (`usuario_id`, `categoria_id`) son la base de todo el filtrado y de los `GROUP BY` de las consultas de inteligencia de negocio; una clave entera de 8 bytes produce índices más compactos y `JOIN` más baratos que un UUID de 16, y este sistema no necesita identificadores impredecibles ni generables por el cliente.

Trade-off asumido: los identificadores son enumerables y aparecen en las URL. Es aceptable porque el aislamiento no descansa en que el identificador sea secreto, sino en que toda consulta de negocio filtrará por el usuario del token.

### Tipos de columna y restricciones

- `usuarios`: `email CITEXT NOT NULL UNIQUE` — la unicidad del email debe ser insensible a mayúsculas para que `Ana@x.com` y `ana@x.com` no sean dos cuentas. `CITEXT` (extensión disponible en Supabase) lo consigue en la propia restricción, sin depender de que la aplicación normalice. Alternativa considerada: `TEXT` con índice único sobre `LOWER(email)`; funciona igual pero obliga a recordar el `LOWER()` en cada consulta de login. Si la extensión `citext` no puede habilitarse, se cae a esa alternativa.
- `usuarios.password_hash TEXT NOT NULL` — nombre explícito para que ningún desarrollador confunda la columna con una contraseña. Nunca se incluye en las listas de columnas de un `SELECT` salvo en la consulta de login.
- `usuarios.nombre TEXT` anulable, con `CHECK` de longitud entre 1 y 100 cuando tiene valor — el registro no lo exige (ver decisión 1 de la propuesta), pero el `CHECK` impide que se cuele una cadena vacía, que sería un tercer estado indistinguible de "sin nombre" y obligaría a comprobar dos cosas en cada consumidor.
- `tareas.titulo TEXT NOT NULL` con `CHECK` de longitud entre 1 y 200, y `tareas.descripcion TEXT` anulable con `CHECK` de hasta 2000. Los límites viven en la base de datos además de en la validación de entrada: la validación protege la experiencia de uso, la restricción protege el dato frente a cualquier vía de escritura.
- `tareas.estado` y `tareas.prioridad`: `TEXT NOT NULL` con `CHECK` sobre un conjunto cerrado de valores y con `DEFAULT` (`pendiente` y `media`), no `ENUM` de PostgreSQL. Motivo: añadir un valor a un `CHECK` es un `ALTER` trivial, mientras que evolucionar un tipo `ENUM` es más rígido.
- `tareas.fecha_vencimiento DATE` anulable — una tarea sin fecha límite es válida, y el tipo `DATE` designa un día del calendario sin hora, de modo que "vencida" no cambie de significado según la zona horaria del consultante.
- Marcas de tiempo `TIMESTAMPTZ`: `creado_en NOT NULL DEFAULT NOW()` en todas las tablas; en `tareas`, además, `actualizado_en NOT NULL DEFAULT NOW()` y `completada_en` anulable. Estas dos últimas existen desde el primer día porque registran un hecho en el instante en que ocurre: si la columna se añadiera más tarde, las tareas ya completadas habrían perdido para siempre su momento de finalización, y con él la posibilidad de responder cuánto tarda un usuario en cerrar lo que abre. La estructura se puede añadir después; el dato no.
- `actualizado_en` se mantiene mediante un disparador `BEFORE UPDATE` en `tareas`, no desde la aplicación. Un disparador no puede olvidarse en una consulta nueva, y este esquema tendrá varias rutas de escritura sobre la tarea cuando lleguen los endpoints de negocio.

### Reglas de borrado

- `categorias.usuario_id`, `etiquetas.usuario_id`, `tareas.usuario_id` → `ON DELETE CASCADE`: sin dueño, esos datos no son alcanzables por nadie.
- `tareas.categoria_id` → `NULL` permitido y `ON DELETE SET NULL`: borrar una categoría es un acto de organización y no debe destruir trabajo del usuario.
- `tarea_etiquetas` → clave primaria compuesta `(tarea_id, etiqueta_id)` con `ON DELETE CASCADE` por ambos lados. La clave compuesta da gratis el requisito de que una etiqueta no se asocie dos veces a la misma tarea, sin lógica en la aplicación.
- Unicidad por dueño: `UNIQUE (usuario_id, nombre)` en `categorias` y en `etiquetas`, con `nombre` de tipo `CITEXT` para que "Trabajo" y "trabajo" sean el mismo nombre. Dos usuarios distintos pueden tener cada uno una categoría "Trabajo", pero un mismo usuario no puede tener dos. Se usa `CITEXT` y no un índice sobre `LOWER(nombre)` por coherencia con la decisión tomada para el email, y para que la comparación insensible a la caja no dependa de recordarla en cada consulta.

### Índices y qué consulta motiva cada uno

- `tareas (usuario_id, estado)` — sostiene el listado principal de tareas del usuario filtrado por estado, el filtro más frecuente de la API, y el recuento de tareas por estado.
- `tareas (usuario_id, categoria_id)` — filtro por categoría y agregación de tareas por categoría.
- `tareas (usuario_id, prioridad)` — filtro por prioridad y distribución de tareas por prioridad.
- `tareas (usuario_id, fecha_vencimiento)` — filtro por rango de fechas y la consulta de tareas vencidas o próximas a vencer.
- `tarea_etiquetas (etiqueta_id)` — la clave primaria compuesta ya cubre la navegación de tarea a etiquetas; este índice cubre la dirección inversa, necesaria para filtrar tareas por etiqueta y para contar el uso de cada etiqueta.
- `categorias (usuario_id)` y `etiquetas (usuario_id)` — quedan cubiertos por sus restricciones `UNIQUE (usuario_id, nombre)`, cuyo índice tiene `usuario_id` como primera columna; no se crean índices adicionales.

Todos los índices de `tareas` llevan `usuario_id` como primera columna porque ninguna consulta de negocio cruzará jamás la frontera de un usuario: el filtro por dueño está siempre presente.

### Autenticación: bcrypt y JWT firmado con HS256

- Hash con `bcrypt`, factor de coste 10. Justificación de la dependencia: es el algoritmo que el reto nombra explícitamente, incorpora sal por diseño y su coste es ajustable. Alternativa considerada: `argon2`, preferible en abstracto pero con dependencia nativa que complica la instalación en el entorno del evaluador.
- Contraseña de 8 a 72 caracteres, sin reglas de composición. El techo de 72 es una propiedad de bcrypt, no una preferencia: el algoritmo ignora los bytes posteriores, de modo que aceptar una contraseña más larga significaría que dos contraseñas distintas que comparten sus primeros 72 bytes abren la misma cuenta. Se valida y se rechaza con `400` en lugar de truncar en silencio, que es el fallo clásico de esta primitiva. Nota de implementación: el límite es de **bytes**, y un carácter acentuado ocupa más de uno; la validación mide bytes en UTF-8, no caracteres.
- JWT firmado con `HS256` y secreto simétrico en `JWT_SECRET`. Con un único servicio emisor y verificador, la firma asimétrica no aporta nada y añade gestión de claves.
- Contenido del token: identificador del usuario y su email, más expiración. **No** se incluye ningún dato mutable adicional, para que un token no pueda quedar desincronizado del estado real. La duración por defecto es 24 h, configurable vía `JWT_EXPIRACION`.
- El middleware verifica la firma y la expiración, y deja la identidad en `req.usuario`. No consulta la base de datos en cada petición: el token es autosuficiente. Consecuencia asumida, ya registrada en la propuesta: un usuario eliminado conserva un token técnicamente válido hasta que expire; sus consultas de negocio no devolverán datos porque sus filas ya no existen.
- La respuesta de login lleva `{ token, usuario: { id, email, nombre } }`. Incluir al usuario ahorra a la SPA una llamada a `/perfil` en el arranque, que es exactamente el momento en que la persona está esperando ver la pantalla. `GET /api/auth/perfil` sigue existiendo porque es lo que permite validar un token guardado al recargar la página, sin volver a pedir credenciales.
- El JWT se devuelve en el cuerpo de la respuesta de login, no en una cookie. El frontend es una SPA que enviará la cabecera `Authorization` explícitamente; usar cookie exigiría además protección CSRF que el reto no contempla.

### Serialización: los datos públicos del usuario se construyen, no se filtran

Los repositorios que devuelven usuarios seleccionan columnas de forma explícita (`id, email, nombre, creado_en`) en lugar de hacer `SELECT *` y borrar después el campo del hash. Una lista explícita de columnas no puede olvidarse de eliminar nada: es la única forma de garantizar el requisito de que el hash nunca sale de la API sin depender de la disciplina de cada endpoint. La única consulta que trae `password_hash` es la de login, y su resultado nunca se pasa a la respuesta.

### Manejo de errores centralizado

Un middleware de error final traduce el error a una respuesta con la forma `{ error: { codigo, mensaje, detalles? } }`. `codigo` es un identificador estable en mayúsculas —`DATOS_INVALIDOS`, `EMAIL_DUPLICADO`, `CREDENCIALES_INVALIDAS`, `NO_AUTENTICADO`, `NO_ENCONTRADO`, `ERROR_INTERNO`— y `mensaje` es texto en español dirigido a la persona usuaria. El cliente decide su comportamiento por el código y nunca por el texto, de modo que reescribir un mensaje no rompa la interfaz; es también lo que permite traducir la interfaz más adelante sin tocar el backend. Los errores de negocio previstos (email duplicado, credenciales inválidas, no autenticado) se lanzan como errores tipados con su código HTTP; cualquier otro se responde como `500` con mensaje genérico y se registra completo en el servidor. Ningún manejador construye respuestas de error por su cuenta, para que el formato no diverja endpoint a endpoint.

La violación de la restricción `UNIQUE` del email se detecta por el código de error `23505` de PostgreSQL y se traduce a `409`. Se prefiere esto a consultar primero si el email existe: evita una condición de carrera entre la comprobación y la inserción.

### Validación de entrada

Validación manual en funciones dedicadas de `src/utils/validacion.js`, sin librería. Los tres endpoints de este cambio manejan dos campos entre ambos; introducir `zod` o `express-validator` aquí sería una dependencia por adelantado. Si el cambio de tareas —con muchos más campos y filtros— lo justifica, se incorporará entonces con su justificación escrita.

### Dependencias nuevas y su justificación

| Dependencia | Por qué |
| --- | --- |
| `express` | Framework HTTP fijado por el stack del proyecto. |
| `pg` | Driver PostgreSQL fijado por el stack; provee el `Pool` de conexiones y las consultas parametrizadas. |
| `bcrypt` | Hash de contraseñas con sal; nombrado por el reto. |
| `jsonwebtoken` | Emisión y verificación de JWT; el mecanismo de autenticación fijado. |
| `dotenv` | Carga de `DATABASE_URL` y `JWT_SECRET` desde `.env` en desarrollo. |
| `cors` (dev) | El frontend correrá en un origen distinto al del backend; sin esto la SPA del siguiente cambio no podría llamar a la API. |

Ninguna es un ORM ni una capa de abstracción sobre SQL.

## Risks / Trade-offs

- **El DDL se ejecuta a mano una sola vez contra una base compartida** → `schema.sql` se escribe con `CREATE TABLE IF NOT EXISTS` y `CREATE INDEX IF NOT EXISTS`, de modo que reejecutarlo sea inocuo. Los cambios de esquema posteriores se añaden como sentencias nuevas al final del archivo, no editando las existentes.
- **Un `JWT_SECRET` débil o versionado por accidente compromete todas las cuentas** → el secreto solo vive en `.env`, `.env.example` lo documenta sin valor real, `.gitignore` excluye `.env` desde el primer commit, y el servidor se niega a arrancar si `JWT_SECRET` falta o es más corto que 32 caracteres.
- **No hay revocación de tokens**: un token robado es válido hasta su expiración → mitigado parcialmente por la duración de 24 h. Aceptado explícitamente; el reto no pide revocación.
- **`bcrypt` incluye una compilación nativa** que puede fallar en algunos entornos → si la instalación da problemas en la máquina del evaluador, `bcryptjs` es un sustituto de la misma API sin código nativo, a costa de más lentitud. Se documentará como alternativa en el README si llega a hacer falta.
- **Sin restricción de unicidad, dos peticiones de registro simultáneas con el mismo email crearían dos cuentas** → la restricción `UNIQUE` en base de datos es la que garantiza el requisito, no la comprobación en la aplicación.
- **La conexión a Supabase exige TLS y limita las conexiones concurrentes** → un único `Pool` compartido en todo el proceso, con `ssl` habilitado y un máximo de conexiones conservador.
- **El aislamiento entre usuarios solo queda cimentado, no aplicado, en este cambio** → aquí no existe ningún endpoint que lea tareas, categorías o etiquetas, así que no hay superficie por la que filtrarse. El cambio de endpoints de negocio debe establecer como requisito que toda consulta lleve el filtro por dueño.

## Migration Plan

No hay datos previos que migrar. Despliegue:

1. Habilitar la extensión `citext` en la base de Supabase.
2. Ejecutar `bd/schema.sql` una vez contra `DATABASE_URL`.
3. Verificar que las cinco tablas y sus índices existen.

Reversión: `schema.sql` se acompaña de las sentencias `DROP TABLE` en orden inverso de dependencia, comentadas al final del archivo, para poder rehacer el esquema desde cero mientras no haya datos reales.

## Open Questions

- Los valores de `tareas.estado` y `tareas.prioridad` quedan fijados en la propuesta (decisión 9): `pendiente`/`en_progreso`/`completada` y `baja`/`media`/`alta`, con `pendiente` y `media` por defecto. Si el cambio de tareas necesitara afinar el vocabulario, es un `ALTER` de una línea sobre el `CHECK`.
- Las diez consultas de inteligencia de negocio del reto no están enumeradas en el contexto del proyecto. Los índices anteriores se justifican por los filtros conocidos de la API (estado, categoría, prioridad, fecha de vencimiento, dueño) y por las agregaciones que esos mismos ejes hacen previsibles. Cuando esas consultas se definan, podrán requerir índices adicionales, que se añadirán en su propio cambio.
