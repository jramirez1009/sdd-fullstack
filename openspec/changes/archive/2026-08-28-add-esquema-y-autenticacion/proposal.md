## Why

La aplicación no tiene todavía ni persistencia ni identidad: no existe una base de datos con las tablas del dominio ni una forma de que un usuario se identifique ante la API. Toda funcionalidad de negocio del reto (tareas, categorías, etiquetas, filtrado, inteligencia de negocio) se apoya en dos cosas que hay que fijar primero: un esquema relacional con integridad referencial y un flujo de autenticación por JWT que permita marcar cada endpoint futuro como protegido y atribuir cada fila a su dueño.

Este es el primero de una serie de cambios incrementales. Se hace ahora porque ningún cambio posterior puede escribirse sin que estas tablas y este mecanismo de identidad existan.

## What Changes

- **Esquema de base de datos completo** (`schema.sql`, DDL ejecutado una sola vez contra la instancia PostgreSQL de Supabase): tablas `usuarios`, `categorias`, `etiquetas`, `tareas` y `tarea_etiquetas`, con claves primarias, claves foráneas, restricciones `NOT NULL`/`UNIQUE` e índices para los filtros previstos (estado, categoría, prioridad, fecha de vencimiento, dueño).
- **Integridad de propiedad a nivel de esquema**: `categorias`, `etiquetas` y `tareas` cuelgan de `usuarios` por clave foránea con `ON DELETE CASCADE`; `tareas.categoria_id` es anulable con `ON DELETE SET NULL`; `tarea_etiquetas` modela la relación muchos a muchos con clave primaria compuesta y cascada por ambos lados.
- **Registro de usuario** (`POST /api/auth/registro`): email único en todo el sistema, contraseña almacenada exclusivamente como hash bcrypt, y nombre para mostrar opcional.
- **Login** (`POST /api/auth/login`): valida email + contraseña y emite un JWT firmado junto con los datos públicos del usuario; sin estado de sesión en servidor.
- **Middleware de autenticación**: verifica el JWT del encabezado `Authorization: Bearer <token>` y expone la identidad del usuario autenticado a los manejadores posteriores. Es la pieza que consumirán todos los endpoints protegidos de los cambios siguientes.
- **Perfil del usuario autenticado** (`GET /api/auth/perfil`): protegido, devuelve los datos del usuario del token y nunca los de otro.
- **Invariante transversal**: ninguna respuesta de la API, en ningún endpoint y bajo ninguna condición de error, incluye el hash de contraseña.
- **Conexión a PostgreSQL** vía pool del driver `pg`, con SQL parametrizado en todas las consultas.
- **Validación de entrada y respuestas de error uniformes** para los tres endpoints anteriores, sin filtrar detalles internos (stack traces, mensajes del driver) al cliente.

No hay cambios de ruptura: no existe comportamiento previo que romper.

## Capabilities

### New Capabilities
- `esquema-datos`: estructura relacional persistente del dominio — entidades, relaciones, restricciones de integridad y reglas de borrado en cascada que garantizan que cada dato tenga un dueño.
- `autenticacion`: registro, inicio de sesión, emisión y verificación de JWT, y acceso al perfil del usuario autenticado; define qué significa "endpoint protegido" para el resto del sistema.

### Modified Capabilities
<!-- Ninguna: no hay specs vivas todavía. -->

## Impact

- **Base de datos**: creación de las cinco tablas y sus índices en la instancia Supabase compartida. `schema.sql` se versiona en el repositorio como documentación reproducible del esquema.
- **Backend nuevo**: capa de conexión (`pg` Pool), rutas y controladores de `/api/auth`, middleware de verificación de JWT, utilidades de hash de contraseña.
- **Configuración**: `.env` pasa a requerir `DATABASE_URL`, `JWT_SECRET` y la duración del token; `.env.example` documenta cada una sin credenciales reales.
- **Dependencias nuevas**: `express`, `pg`, `bcrypt`, `jsonwebtoken`, `dotenv`. Ninguna es un ORM; su justificación individual va en design.md.
- **Cambios posteriores habilitados**: los endpoints de tareas, categorías y etiquetas podrán declararse protegidos y filtrar por dueño apoyándose en el middleware y en las claves foráneas que este cambio establece.

## Decisiones registradas

- **2026-08-28 — El esquema completo entra en este cambio, no solo `usuarios`.** Aunque los endpoints de tareas, categorías y etiquetas llegan después, sus tablas se crean aquí. Motivo: el DDL se ejecuta una sola vez contra la base ya alojada, y partirlo en migraciones sucesivas añade complejidad de despliegue sin beneficio para un entregable de evaluación.
- **2026-08-28 — Los datos de un usuario son exclusivamente suyos.** No hay compartición, ni roles, ni administrador. El aislamiento se cimenta aquí a nivel de esquema (clave foránea a `usuarios`) y se hará cumplir a nivel de consulta cuando existan los endpoints correspondientes.
- **2026-08-28 — Borrar una categoría no borra sus tareas.** Las tareas afectadas quedan sin categoría (`categoria_id` a `NULL`). Se prefiere no destruir trabajo del usuario ante una acción de organización.
- **2026-08-28 — Borrar un usuario borra en cascada todo lo suyo** (categorías, etiquetas, tareas y sus vínculos): sin dueño, esos datos no son alcanzables por nadie.
- **2026-08-28 — No hay sesiones de servidor.** El JWT es el único portador de identidad aceptado por la API. Consecuencia asumida: no existe revocación inmediata de tokens; el reto no la pide.
- **2026-08-28 — Fuera de alcance en este cambio**: endpoints de tareas, categorías y etiquetas más allá de las tablas que los soportan; filtrado y búsqueda; consultas de inteligencia de negocio; frontend (formularios de login/registro, Context API de autenticación); rate limiting específico por endpoint (se definirá como middleware global en otro cambio); recuperación de contraseña olvidada (no la pide el reto).
- **2026-08-28 — Supuesto registrado**: el poblado de datos de ejemplo (`seed.sql`) no forma parte de este cambio; se aborda con el cambio de entrega, una vez que existan las entidades de negocio que poblar.

## Decisiones sobre las ambigüedades detectadas

Las quince cuestiones de negocio que la propuesta dejaba abiertas se resuelven aquí. Todas se deciden el **2026-08-28**.

### Criterio que gobierna qué entra ahora en el esquema

Añadir una columna anulable a PostgreSQL más adelante es un `ALTER TABLE ADD COLUMN` trivial: la **estructura** no es el recurso escaso. Lo irreversible es el **dato que no se captura en el instante en que ocurre**, porque no se puede reconstruir después. Por eso entran ahora las columnas que registran un hecho en el momento en que sucede (cuándo se creó, cuándo se modificó, cuándo se completó una tarea, cómo se llama quien se registra) y quedan fuera las que solo describen apariencia, que podrán añadirse el día que se usen sin haber perdido nada.

### Identidad y credenciales

1. **El registro acepta un `nombre` opcional.** La columna existe en `usuarios` y es anulable; `POST /api/auth/registro` la acepta pero no la exige, y `GET /api/auth/perfil` la devuelve. Motivo: el reto define el registro con email y contraseña, y hacer obligatorio un tercer campo rompería esa expectativa ante quien evalúe; pero el nombre es un dato que solo puede capturarse en el momento del alta, y el frontend lo necesitará para dirigirse al usuario. Opcional satisface ambas cosas.

2. **Una contraseña válida mide entre 8 y 72 bytes, sin reglas de composición.** No se exige mayúscula, dígito ni símbolo: las reglas de composición empujan a las personas hacia contraseñas predecibles, y la recomendación vigente (NIST SP 800-63B) es priorizar longitud sobre composición. El máximo de 72 no es arbitrario: bcrypt ignora los bytes que exceden esa cifra, así que aceptar una contraseña más larga daría una falsa sensación de seguridad y haría que dos contraseñas distintas abrieran la misma cuenta. Se valida y se rechaza con `400`, en lugar de truncar en silencio. El límite se cuenta en bytes y no en caracteres porque una letra acentuada ocupa más de un byte.

3. **Dos emails que solo difieren en mayúsculas son la misma cuenta.** `Ana@x.com` no puede registrarse si ya existe `ana@x.com`. Es lo que una persona espera de su dirección de correo, y evita cuentas duplicadas indistinguibles a simple vista.

4. **El token dura 24 horas.** Como no hay revocación, esta cifra es de facto la política de sesión: acota la ventana de uso de un token robado sin obligar a reautenticarse durante una sesión de trabajo o de evaluación. Es configurable por variable de entorno.

5. **El login devuelve el token y los datos públicos del usuario** (`id`, `email`, `nombre`), no solo el token. Ahorra a la SPA una llamada a `/perfil` nada más entrar, que es justo el momento en que el usuario está esperando ver la pantalla.

6. **Los mensajes de error al cliente van en español**, acompañados de un código estable en mayúsculas (`EMAIL_DUPLICADO`, `CREDENCIALES_INVALIDAS`, `NO_AUTENTICADO`, `DATOS_INVALIDOS`). El frontend decide su comportamiento por el código, nunca por el texto, para que reescribir un mensaje no rompa la interfaz.

### Datos de negocio

7. **`tareas` se crea con este conjunto de columnas**: `id`, `usuario_id`, `categoria_id` (anulable), `titulo` (obligatorio, 1 a 200 caracteres), `descripcion` (anulable, hasta 2000 caracteres), `estado`, `prioridad`, `fecha_vencimiento` (anulable), `creado_en`, `actualizado_en` y `completada_en` (anulable). Las tres marcas de tiempo entran por el criterio anterior: sin `completada_en` ninguna consulta de inteligencia de negocio podrá responder cuánto tarda el usuario en terminar lo que empieza, y ese dato no se puede reconstruir a posteriori para las tareas ya completadas.

8. **`fecha_vencimiento` es una fecha sin hora.** Una tarea vence un día, no a las 18:00. Evita además que la misma tarea aparezca como vencida o no según la zona horaria desde la que se consulte, que es el problema real de guardar una hora que nadie ha elegido.

9. **Los estados son `pendiente`, `en_progreso` y `completada`; las prioridades, `baja`, `media` y `alta`.** Una tarea nace `pendiente` y con prioridad `media`, de modo que crear una tarea no obligue a tomar dos decisiones que casi siempre son la misma.

10. **Un usuario no puede tener dos categorías con el mismo nombre, ni dos etiquetas con el mismo nombre**, y la comparación ignora mayúsculas: "Trabajo" y "trabajo" son la misma categoría. Sin esto, la lista de categorías del usuario se llena de duplicados que él mismo no distingue. La restricción es por usuario: dos personas distintas pueden tener cada una su categoría "Trabajo".

11. **Las categorías no llevan color ni icono.** Es apariencia, no un hecho que se pierda si no se captura hoy; el día que la interfaz lo necesite, se añade la columna sin haber perdido ningún dato.

### Alcance de la gestión de cuenta

12. **No hay endpoint de baja de cuenta en este cambio.** La regla de borrado en cascada sigue vigente, pero como garantía de integridad del esquema —no puede quedar un dato sin dueño— y no como funcionalidad expuesta. El reto no pide dar de baja una cuenta.

13. **No hay cambio de contraseña ni de email** una vez registrado el usuario. Fuera del alcance del reto.

14. **No hay verificación de email ni activación de cuenta**: quien se registra queda operativo de inmediato. Exigir verificación obligaría a montar envío de correo, que el reto no contempla y que entorpecería la evaluación.

15. **El cierre de sesión ocurre solo en el cliente**, descartando el token. Es la consecuencia directa de no mantener estado de sesión en el servidor, ya asumida más arriba.
