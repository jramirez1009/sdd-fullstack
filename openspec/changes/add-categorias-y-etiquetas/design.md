## Context

Ver `proposal.md` — Why para la motivación. Lo relevante para el diseño es el estado actual del backend, ya construido en `add-esquema-y-autenticacion`:

- **Las tablas ya existen y ya imponen las reglas.** `categorias` y `etiquetas` tienen `usuario_id NOT NULL REFERENCES usuarios ON DELETE CASCADE`, `nombre CITEXT` con `CHECK` de longitud (1–100 para categorías, 1–50 para etiquetas) y `UNIQUE (usuario_id, nombre)`. La cascada de `tarea_etiquetas` y el `ON DELETE SET NULL` de `tareas.categoria_id` ya están definidos. Este cambio **no toca el esquema**: consume lo que hay.
- **`CITEXT` significa que la insensibilidad a mayúsculas no es responsabilidad de la aplicación.** Ninguna consulta necesita `LOWER()`: la restricción `UNIQUE` y la comparación de igualdad ya la aplican por sí solas.
- **El middleware `requiereAutenticacion` ya deja `req.usuario = { id, email }`** y corta con `401` ante cualquier fallo.
- **El manejador de errores es el único punto que construye respuestas de error**, a partir de `ErrorAplicacion` (estado HTTP + código estable + mensaje en español). Los controladores lanzan, nunca responden un error a mano.
- **Convención vigente en `usuariosRepo.js`**: todo el SQL vive en `src/repositorios/`, con marcadores de parámetro y listas de columnas explícitas.

La única pieza que este cambio inaugura y que el resto del proyecto heredará es el **patrón de acceso multi-inquilino**: cómo se garantiza, consulta a consulta, que un usuario nunca alcanza el dato de otro.

## Goals / Non-Goals

**Goals:**

- Que el aislamiento entre usuarios sea **estructuralmente imposible de olvidar**, no una comprobación que cada controlador debe acordarse de escribir.
- Que la respuesta `404` ante un recurso ajeno sea **indistinguible** de la de un identificador inexistente, sin ramas condicionales que puedan divergir.
- Que la unicidad de nombre por usuario se resuelva **sin condiciones de carrera**.
- Dejar establecido el molde de repositorio, controlador y ruta que reutilizarán tareas y las consultas de inteligencia de negocio.

**Non-Goals:**

- No se introduce una capa de servicios entre controlador y repositorio: para un CRUD sin lógica de negocio propia solo añadiría indirección.
- No se abstraen categorías y etiquetas en un CRUD genérico parametrizado (ver Decisiones).
- No se añaden tests automatizados como entregable de este cambio; la verificación va en `tasks.md` como comprobación manual contra el servidor, igual que en el cambio anterior.

## Decisions

### 1. El identificador del dueño viaja en el `WHERE`, no en un `if` del controlador

Toda consulta de estos repositorios recibe `usuarioId` como parámetro y lo lleva en su cláusula `WHERE`, incluidas las de escritura:

```
UPDATE categorias SET nombre = $1 WHERE id = $2 AND usuario_id = $3 RETURNING id, nombre
DELETE FROM categorias WHERE id = $1 AND usuario_id = $2
```

El controlador no comprueba la propiedad: si la consulta no devuelve fila (o `rowCount` es 0), lanza `errorNoEncontrado()`.

**Por qué, y no la alternativa obvia** —leer el recurso, comparar `categoria.usuario_id` con `req.usuario.id` y decidir—: esa forma tiene tres defectos. Primero, deja la seguridad en manos de un `if` que un endpoint futuro puede olvidar y que ninguna prueba detecta hasta que el dato ya se filtró. Segundo, abre una ventana entre la lectura y la escritura en la que la propiedad podría cambiar. Tercero, y decisivo: obliga a escribir explícitamente la rama "existe pero es de otro", que es justo la rama que no debe existir para que `404` y `404` sean indistinguibles. Con el filtro en el `WHERE`, un recurso ajeno **no se encuentra**, literalmente, y solo hay un camino de código posible.

### 2. Ausencia de fila, no consulta previa de existencia

Ni la edición ni el borrado leen antes para comprobar que el recurso existe. Se ejecuta la sentencia con `RETURNING` (o se mira `rowCount` en el `DELETE`) y la ausencia de resultado **es** la señal de `404`. Una sola ida y vuelta a la base, sin ventana entre comprobación y acción.

### 3. La unicidad la impone la base de datos; la aplicación solo traduce el fallo

No hay `SELECT` previo que compruebe si el nombre ya está usado. Se intenta la inserción o la actualización y, si PostgreSQL responde `23505`, se traduce a `409 NOMBRE_DUPLICADO`. Es el mismo patrón que ya usa el registro de usuario con `EMAIL_DUPLICADO`, y por el mismo motivo: comprobar antes abre una condición de carrera entre la comprobación y la escritura que la restricción `UNIQUE` cierra por definición.

Para no confundir causas, el controlador **inspecciona `error.constraint`** y solo traduce cuando es la restricción de nombre por usuario que le corresponde; cualquier otra violación se deja propagar como error interno. El nombre de la restricción se usa para decidir, nunca aparece en la respuesta.

Como efecto secundario deseable, esto resuelve solo el escenario "renombrar a su propio nombre actual": actualizar una fila al valor que ya tiene no viola su propia restricción `UNIQUE`, así que responde `200` sin ningún caso especial escrito a mano.

### 4. Dos repositorios explícitos, no un CRUD genérico parametrizado por tabla

Categorías y etiquetas tienen consultas casi idénticas, y la tentación es escribir una fábrica `crearRepoCrud('categorias')`. Se descarta: el nombre de la tabla no puede ir como parámetro `$1` —PostgreSQL solo parametriza valores, no identificadores—, así que una fábrica así tendría que **interpolar el nombre de tabla en la cadena SQL**. Aunque ese valor no venga del cliente, el proyecto tiene una regla dura de que ninguna consulta se construye por concatenación, y una regla que admite excepciones "seguras" deja de ser verificable de un vistazo.

Se pagan unas cuarenta líneas de SQL casi repetido a cambio de que toda consulta del sistema siga siendo una cadena literal auditable. Además, los dos recursos ya divergen: distinta longitud máxima de nombre y distinta consecuencia al borrar.

Lo que **sí** se comparte, porque no es SQL: el parseo y validación del identificador de ruta, la validación de nombre (parametrizada por longitud máxima) y la traducción de `23505`.

### 5. La autenticación se monta en el router, no en cada ruta

```
app.use('/api/categorias', requiereAutenticacion, categoriasRutas);
```

Un endpoint nuevo añadido al router queda protegido por el hecho de existir. Colgar `requiereAutenticacion` de cada ruta individual, como hace hoy `/api/auth/perfil`, es correcto ahí porque ese router mezcla rutas públicas y protegidas; aquí, donde **todas** son protegidas, hacerlo ruta a ruta solo crea la posibilidad de olvidarlo.

### 6. Un identificador de ruta mal formado se rechaza con `400` antes de tocar la base

Los identificadores son `BIGINT`. Si `:id` no es un entero positivo, el controlador lanza `errorDatosInvalidos` sin consultar. Motivo práctico: pasar `"abc"` a una comparación con `BIGINT` provoca el error `22P02` de PostgreSQL, que llegaría al manejador como error interno y respondería `500` a lo que es un fallo del cliente.

Esto no debilita la indistinguibilidad exigida por las specs: un identificador que no es un número **no puede corresponder a ningún recurso real**, ni propio ni ajeno, así que su respuesta no revela nada sobre lo que existe. La indistinguibilidad se exige entre identificadores bien formados, y ahí ambos casos recorren exactamente el mismo camino.

### 7. Ordenación por nombre en la consulta, no en la aplicación

`ORDER BY nombre` en el `SELECT`. Al ser `nombre` de tipo `CITEXT`, el orden ya es insensible a mayúsculas, que es lo que una persona espera al ver su lista. Ordenar en JavaScript exigiría replicar esa insensibilidad a mano y divergiría el día que aparezca paginación.

El índice de la restricción `UNIQUE (usuario_id, nombre)` cubre exactamente esta consulta —filtra por `usuario_id` y devuelve ya ordenado por `nombre`—, así que el listado no necesita ordenación adicional ni índice nuevo.

### 8. Sin dependencias nuevas

Este cambio no añade ningún paquete. Se usan `express` y `pg`, ya presentes.

## Risks / Trade-offs

- **[El filtro por dueño se olvida en una consulta futura]** → Toda función de estos repositorios recibe `usuarioId` como parámetro **obligatorio** de su firma, de modo que omitirlo sea un error visible al escribir la llamada y no un filtro ausente en una cadena SQL. La tarea de auditoría de `tasks.md` revisa que ninguna consulta de negocio carezca de `usuario_id` en su `WHERE`.
- **[Traducir todo `23505` a `NOMBRE_DUPLICADO` enmascararía otra violación de unicidad]** → Se comprueba `error.constraint` antes de traducir; lo que no coincide se propaga y acaba en `500` con el detalle solo en los registros del servidor, que es el comportamiento correcto para un fallo no previsto.
- **[Duplicación entre `categoriasRepo` y `etiquetasRepo`]** → Aceptada conscientemente (Decisión 4). El coste es real pero acotado y no crece: son dos recursos, no una familia abierta. Si apareciera un tercero con el mismo molde, convendría revisar la decisión.
- **[Un usuario podría crear categorías o etiquetas sin límite]** → No se pone cota en este cambio. El rate limiting global, ya previsto como cambio aparte, es el lugar correcto para acotarlo; un límite de cardinalidad inventado aquí sería una regla de negocio que nadie ha pedido.
- **[`404` ante recurso ajeno puede desconcertar en desarrollo]** → Es el compromiso deliberado entre claridad de depuración y no filtrar la existencia de recursos. Queda registrado en `proposal.md` y explicado en el mensaje en español que acompaña al código `NO_ENCONTRADO`.

## Migration Plan

No hay migración: el esquema no cambia y no existe comportamiento previo que preservar. Los endpoints son puramente aditivos, así que el despliegue es el arranque normal del servidor y la reversión es retirar el montaje de ambos routers en `src/app.js`, sin ninguna consecuencia sobre los datos.
