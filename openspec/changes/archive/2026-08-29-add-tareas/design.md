## Context

Ver `proposal.md` — Why para la motivación, y `specs/tareas/spec.md` para el contrato de comportamiento. Aquí solo el estado del código que condiciona el enfoque.

Lo que ya existe y este cambio hereda sin discutir:

- `src/config/bd.js` expone un único `Pool` y una función `consultar(texto, parametros)`. **No hay ninguna primitiva de transacción**, porque hasta ahora ninguna operación escribía en más de una tabla. Este cambio sí lo hace: crear una tarea con etiquetas toca `tareas` y `tarea_etiquetas`.
- `src/repositorios/` concentra todo el SQL, siempre como cadena literal con marcadores de parámetro. `categoriasRepo` fija el patrón: lista explícita de columnas públicas, `usuario_id` en el `WHERE` de todas las consultas —también las de escritura—, y devolver `null` o `false` cuando no hay fila, para que exista un único camino de código hacia el `404`.
- `src/middleware/errores.js` es el único punto que construye respuestas de error, a partir de `ErrorAplicacion` (estado HTTP + código estable). `src/utils/identificadores.js` ya tiene `parsearIdRuta`.
- El esquema ya tiene la tabla `tareas` con `estado` (`pendiente` / `en_progreso` / `completada`), `prioridad`, `fecha_vencimiento DATE`, `completada_en`, un disparador que mantiene `actualizado_en`, y cuatro índices que empiezan por `usuario_id` cubriendo estado, categoría, prioridad y vencimiento. `tarea_etiquetas` tiene clave primaria compuesta y cascada desde ambos lados.

La restricción nueva que domina el diseño: `GET /api/tareas` es la primera consulta del sistema cuya forma depende de la petición —hasta siete filtros combinables y cuatro ordenaciones—, y el proyecto prohíbe concatenar SQL. Todo el diseño del repositorio gira alrededor de eso.

## Goals / Non-Goals

**Goals:**

- Construir la consulta variable del listado sin que ningún valor del cliente llegue nunca al texto SQL: los valores, como parámetros; los identificadores de columna, desde listas blancas del propio código.
- Una sola consulta para el listado, con sus categorías y etiquetas embebidas: nada de una consulta por tarea.
- Escrituras que tocan dos tablas, atómicas: o queda la tarea con sus etiquetas, o no queda nada.
- Mantener el aislamiento por dueño donde ya está —en el `WHERE` del repositorio— y no moverlo al controlador.
- Añadir la búsqueda de texto completo al esquema de forma aditiva e idempotente, sin tocar ninguna columna existente.

**Non-Goals:**

- Optimizar para volúmenes que este proyecto no tiene: sin paginación, sin caché, sin vistas materializadas.
- Exponer `en_progreso`: la columna lo admite, la API de este cambio no lo toca.
- Reescribir `categoriasRepo` ni `etiquetasRepo` para compartir código con `tareasRepo`. Son suficientemente distintos como para que la abstracción prematura costara más de lo que ahorra.

## Decisions

### 1. La búsqueda: columna `tsvector` generada más índice GIN

Se añade a `tareas` una columna generada y almacenada:

```
busqueda_tsv tsvector GENERATED ALWAYS AS (
  to_tsvector('spanish', coalesce(titulo, '') || ' ' || coalesce(descripcion, ''))
) STORED
```

y el índice `CREATE INDEX tareas_usuario_busqueda_idx ON tareas USING GIN (busqueda_tsv)`.

**Qué la motiva**: el filtro `busqueda` de `GET /api/tareas`, que el reto exige sobre título y descripción.

**Por qué generada y no mantenida por disparador o por la aplicación**: es el mismo criterio que ya se aplicó a `actualizado_en`. Una columna generada no puede quedar desincronizada; un disparador o una actualización desde el repositorio sí, en cuanto alguien escriba una consulta de escritura nueva y se olvide. La spec de `esquema-datos` lo exige explícitamente ("sin que ninguna consulta de escritura tenga que acordarse de actualizarlo"). El coste es escritura ligeramente más cara y algo de espacio, irrelevantes frente a una lectura que es la pantalla principal.

**Por qué la configuración `spanish`**: da lematización (encuentra "correr" buscando "corriendo") e insensibilidad a acentos, que es lo que la spec pide. Requiere que `to_tsvector` sea inmutable con la configuración indicada como literal, que es el caso cuando se nombra explícitamente; escribirlo sin nombrarla dependería de un parámetro de sesión y PostgreSQL rechazaría la columna generada.

**Alternativas descartadas**: `ILIKE '%texto%'` no usa índice y obliga a recorrer todas las tareas del usuario, y además no lematiza; `pg_trgm` con índice GIN sí indexa subcadenas, pero tampoco entiende la flexión y añade una extensión para un resultado peor en español.

**Índice GIN sobre la columna sola, no compuesto con `usuario_id`**: un GIN no puede llevar una columna escalar como primera clave sin `btree_gin`, una extensión adicional. El planificador combina el GIN de la búsqueda con el índice B-tree que ya filtra por usuario mediante un `BitmapAnd`, que es suficiente para este volumen. Si alguna vez no lo fuera, añadir `btree_gin` sería un cambio propio con una medición detrás.

### 2. Traducción `completada` (API) ↔ `estado` (esquema)

La frontera está en el repositorio: el SQL selecciona `estado = 'completada' AS completada` y las escrituras traducen en sentido inverso. Los controladores y las respuestas solo conocen el booleano.

`PATCH /api/tareas/:id/completar` es un único `UPDATE` que fija ambas columnas a la vez a partir del booleano recibido:

```
SET estado = CASE WHEN $1 THEN 'completada' ELSE 'pendiente' END,
    completada_en = CASE WHEN $1 THEN NOW() ELSE NULL END
```

Resolverlo en una sola sentencia y no en un "leer, decidir, escribir" evita que dos peticiones concurrentes dejen `estado` y `completada_en` contando cosas distintas, y hace la operación idempotente sin esfuerzo: repetirla escribe el mismo estado.

**Alternativa descartada**: migrar la columna a un booleano `completada`. Destruiría `en_progreso` y contradiría un requisito vivo de `esquema-datos` (estado como conjunto cerrado de valores), obligando a un delta MODIFIED sobre una spec ya archivada, a cambio de nada observable.

### 3. La consulta del listado: fragmentos fijos, valores parametrizados, columnas desde lista blanca

`listarTareas` construye la consulta acumulando fragmentos en un array y empujando valores a un array de parámetros:

- Cada filtro aporta una condición **literal en el código** (`'t.prioridad = $N'`) y empuja su valor al array. El único elemento que varía es el número de marcador, que lo lleva la longitud del array de parámetros, no ninguna entrada del cliente.
- `WHERE t.usuario_id = $1` se añade siempre y el primero, antes de mirar ningún filtro. No es una condición más: es la que hace que ninguna combinación pueda devolver una tarea ajena.
- `categoria=ninguna` no produce una condición parametrizada sino el fragmento literal `t.categoria_id IS NULL`. El valor reservado se consume entero en la validación y nunca llega a la consulta como parámetro, así que no hay forma de que una cadena del cliente acabe comparándose con una columna.
- `ordenar` y `direccion` no pueden ser parámetros preparados —un identificador de columna no lo es nunca— así que se resuelven contra dos mapas constantes del código. Una clave que no está en el mapa no produce SQL alternativo: produce un `400` en la validación, antes de llegar al repositorio. Es la única defensa real contra la inyección en `ORDER BY`, y por eso la spec exige el rechazo explícito en vez de un descarte silencioso.
- El orden por prioridad usa `CASE prioridad WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END`, escrito en el mapa como cualquier otra expresión de orden. El alfabético (alta, baja, media) no significa nada para nadie.
- Cada entrada del mapa de ordenación lleva, además de su expresión, su dirección por defecto: `desc` para `creado_en` y `prioridad`, `asc` para `titulo` y `fecha_vencimiento`. Vive en el mapa y no en un `if` del controlador porque es un atributo del campo, y así añadir un campo de ordenación obliga a decidir su dirección en el mismo sitio.
- Todo orden termina en `, t.id DESC` como desempate. Sin él, dos consultas idénticas pueden devolver las tareas empatadas en distinto orden y hacer parecer que la lista salta sola.
- El orden por fecha de vencimiento lleva `NULLS LAST` en ambas direcciones: una tarea sin fecha no es ni la más urgente ni la más lejana.

**Alternativa descartada**: un constructor de consultas genérico o un ORM ligero. El proyecto prohíbe el ORM sin justificación escrita, y aquí no la hay: el conjunto de filtros es cerrado y conocido, siete condiciones literales son más auditables que un generador, y una lista blanca explícita se puede leer entera de un vistazo para comprobar que no hay inyección.

### 4. Categoría y etiquetas embebidas sin consulta por tarea

El listado hace un `LEFT JOIN` a `categorias` para los campos de la categoría, y agrega las etiquetas con una subconsulta lateral que produce un `json_agg` por tarea. Una sola ida a la base devuelve todo.

**Por qué no `LEFT JOIN` directo a `tarea_etiquetas` y `etiquetas`**: multiplicaría las filas por el número de etiquetas y obligaría a reagrupar en JavaScript, lo que además rompe cualquier intento futuro de paginar. La agregación en SQL devuelve exactamente una fila por tarea.

**Por qué `json_agg` y no `array_agg` de nombres**: la spec exige que las etiquetas lleguen con la misma forma que devuelven sus propios endpoints —identificador, nombre y fecha de creación—, no solo con su nombre. La agregación produce `[]` y no `null` cuando no hay ninguna, para que el cliente nunca tenga que distinguir dos formas de "sin etiquetas".

**El filtro por etiquetas** (conjunción por nombre) no se resuelve en ese mismo `JOIN`, que sirve para presentar: se resuelve con una condición aparte que exige que el número de etiquetas del usuario con esos nombres asociadas a la tarea sea igual al número de nombres pedidos. Mezclar presentación y filtrado en el mismo `JOIN` haría que filtrar por una etiqueta ocultara las demás de la respuesta.

### 5. Escrituras atómicas: se añade `conTransaccion` a `src/config/bd.js`

Crear una tarea con etiquetas son dos `INSERT` en tablas distintas; editarla son un `UPDATE`, un `DELETE` y un `INSERT`. Sin transacción, un fallo intermedio deja una tarea sin las etiquetas que se pidieron, y la spec exige "o todas o ninguna".

Se añade a `src/config/bd.js` un ayudante `conTransaccion(fn)` que toma un cliente del pool, emite `BEGIN`, pasa el cliente a la función, y hace `COMMIT` o `ROLLBACK` según el resultado, liberando el cliente siempre. Las funciones del repositorio que participan en una transacción aceptan el cliente como parámetro; las que no, siguen usando `consultar`.

No es una dependencia nueva: es `pg` usado como `pg` manda.

### 6. La validación de pertenencia de las referencias se hace dentro de la transacción, no antes

Comprobar que la categoría y las etiquetas son del usuario y después escribir sería una condición de carrera: la categoría puede borrarse entre la comprobación y el `INSERT`. Dentro de la transacción, la comprobación de las etiquetas es un `SELECT id FROM etiquetas WHERE usuario_id = $1 AND id = ANY($2)`, y basta comparar cuántas volvieron con cuántas se pidieron: si falta alguna, se lanza el error de referencia inválida y el `ROLLBACK` deshace la tarea a medio escribir.

Para la categoría no hace falta ni un `SELECT` previo: el `INSERT` de la tarea puede llevar la comprobación de propiedad incorporada, insertando `categoria_id` solo si existe una categoría con ese identificador y ese dueño, y devolviendo cero filas en caso contrario. Se prefiere el `SELECT` explícito de todas formas, porque un `INSERT` que no devuelve filas es ambiguo —no distingue "categoría ajena" de otros motivos— y aquí hace falta un mensaje de error concreto.

**Por qué `= ANY($2)` y no un `IN` con marcadores generados**: `ANY` con un array pasa la lista entera como un solo parámetro. Generar `IN ($2, $3, $4...)` significaría construir texto SQL a partir de la longitud de una lista que viene del cliente, que es exactamente lo que el proyecto prohíbe.

### 7. `400` para la referencia inválida, `404` para el recurso de la ruta

Se añade `REFERENCIA_INVALIDA` al catálogo de `src/utils/errores.js`, con estado `400`. El razonamiento está en `proposal.md`; a nivel de diseño lo que importa es que son dos caminos de código distintos y que ninguno de los dos revela si el recurso ajeno existe: el `404` porque el repositorio nunca encuentra la fila, y el `400` porque el mensaje es el mismo tanto si la referencia no existe como si es de otro.

### 8. `PUT` sustituye, salvo las etiquetas

`PUT /api/tareas/:id` interpreta un campo opcional omitido como vacío, que es lo que un `PUT` hace esperar. La excepción son las etiquetas: omitirlas las conserva, enviarlas las sustituye, enviar una lista vacía las quita. Se distingue "ausente" de "lista vacía" por la presencia de la clave en el cuerpo, no por su valor.

Es una inconsistencia deliberada. La alternativa coherente —omitir etiquetas las borra— haría que cualquier cliente que edite solo el título pierda las etiquetas de la tarea sin haberlo pedido, y es un error que se comete una vez y se paga en datos.

## Risks / Trade-offs

- **La columna generada con `to_tsvector('spanish', ...)` puede fallar al crearse si la configuración de texto `spanish` no está disponible en la instancia de Supabase.** → Se comprueba antes de escribir el DDL definitivo, en la primera tarea de la fase de esquema. Si no estuviera, la alternativa es `simple` (sin lematización, pero sí sin acentos ni caja) documentada como limitación en la spec; no se cambia el enfoque.
- **El índice GIN se combina con el filtro por usuario mediante `BitmapAnd` en vez de con un índice compuesto.** → Aceptado: `btree_gin` sería una extensión más para una ganancia que a este volumen no se mide. Queda registrado para que un cambio futuro lo revise con datos.
- **Añadir una columna generada `STORED` reescribe la tabla `tareas`.** → Se aplica sobre una tabla con datos de prueba y en una fase del proyecto sin usuarios reales. El DDL es idempotente (`ADD COLUMN IF NOT EXISTS`), como el resto de `schema.sql`.
- **La consulta del listado, con `LEFT JOIN`, subconsulta lateral y hasta siete condiciones, es la más compleja del sistema y la más fácil de romper sin darse cuenta.** → Cada filtro y cada orden se verifica por separado contra la base con datos desechables, y además se verifica al menos una combinación de varios, que es donde una condición mal encadenada se manifiesta.
- **La lista blanca de `ordenar` es la única barrera entre el cliente y la cláusula `ORDER BY`.** → Se verifica explícitamente con un valor que contenga SQL, comprobando que responde `400` y que no llega nada al repositorio; y por inspección, que ningún fragmento de la consulta se construye con una cadena que venga de la petición.
- **`json_agg` devuelve las etiquetas ya como JSON, así que su forma no pasa por ninguna lista de columnas públicas de JavaScript.** → La subconsulta enumera explícitamente los campos que construye el objeto; no se usa `to_jsonb(e.*)`, que arrastraría `usuario_id` a la respuesta.

## Migration Plan

1. Añadir a `bd/schema.sql` la columna generada y el índice GIN, con `IF NOT EXISTS`, manteniendo el archivo idempotente y reejecutable.
2. Aplicarlo con `node bd/ejecutar-schema.js` contra la base de Supabase, igual que los cambios anteriores.
3. Verificar que la columna se rellena sola para las filas ya existentes y que la búsqueda usa el índice.

**Reversión**: `DROP INDEX tareas_usuario_busqueda_idx;` y `ALTER TABLE tareas DROP COLUMN busqueda_tsv;`. No hay pérdida de datos: la columna es derivada y se regenera al recrearla. Se documenta en el bloque de reversión comentado que `schema.sql` ya mantiene.

El código de la API es aditivo: hasta que el router se monta en `src/app.js`, nada del cambio es alcanzable, así que revertir es quitar esa línea.

## Decisiones de implementación

Registradas al implementar el cambio, donde el código se apartó de lo que este
documento anticipaba o donde hizo falta decidir algo que no estaba decidido.

- **2026-08-28 — La configuración de texto `spanish` sí está disponible en la
  instancia de Supabase.** Se comprobó antes de escribir el DDL definitivo, como
  preveía el apartado de riesgos: `to_tsvector('spanish', 'corriendo por el
  parque')` devuelve `'corr':1 'parqu':4`, es decir lematiza, y la comparación
  encuentra "Revisión Médica" buscando "revision" y "medica". No hace falta la
  alternativa `simple` ni queda ninguna limitación que documentar en la spec.

- **2026-08-28 — La expresión de orden por prioridad crece con la urgencia
  (`alta` → 3, `media` → 2, `baja` → 1), al revés del fragmento que aparece más
  arriba en este documento.** Escrito como `alta → 1`, y siendo `desc` la
  dirección por defecto de este campo, el resultado habría puesto las tareas de
  prioridad baja primero, que es lo contrario de lo que exige la spec ("por
  prioridad las más urgentes primero"). Se invierte el `CASE` en lugar de
  invertir la dirección por defecto, porque así la dirección conserva el mismo
  significado en los cuatro campos: `desc` es siempre "primero lo que más pesa".

- **2026-08-28 — El mapa de campos de ordenación está partido en dos mitades que
  viven en capas distintas.** `src/utils/validacion.js` tiene la lista blanca de
  campos admitidos con la dirección por defecto de cada uno, que es política y
  no SQL; `src/repositorios/tareasRepo.js` tiene la expresión SQL de cada campo.
  Este documento las situaba ambas en el repositorio. Se separan porque la
  validación tiene que resolver la dirección por defecto para poder rechazar con
  `400` antes de llegar al repositorio, y hacerla importar del repositorio
  invertiría la dirección de las dependencias entre capas. Ambas mitades siguen
  siendo listas blancas constantes: nada de lo que llega en la petición se
  interpola en la consulta.

- **2026-08-28 — Las consultas que escriben y borran en `tarea_etiquetas`
  llevan también `usuario_id`, aunque la tabla no tenga esa columna.** La
  propiedad se exige uniendo con `tareas` y con `etiquetas`, que sí la tienen.
  Las referencias ya se verifican antes en la misma transacción, así que es
  redundante; se hace igualmente para que ninguna consulta de escritura del
  repositorio dependa de que quien la llama haya comprobado la propiedad antes,
  que es la regla que el archivo mantiene desde `categoriasRepo`.

- **2026-08-28 — En la edición, la propiedad de la tarea se comprueba antes que
  las referencias del cuerpo.** `actualizarTarea` empieza con un `SELECT ... FOR
  UPDATE` sobre la tarea del usuario y devuelve `null` si no hay tal fila suya.
  Así, editar una tarea ajena con además una categoría ajena responde `404` y no
  `400`: el recurso que la ruta direcciona manda sobre el contenido del cuerpo.
  El bloqueo de fila impide de paso que dos ediciones simultáneas se pisen.

- **2026-08-28 — Los instantes embebidos en la categoría y en las etiquetas se
  formatean explícitamente como ISO-8601 en UTC con `Z`.** `json_build_object`
  los rendería con el formato de PostgreSQL (`+00:00`), mientras que las
  columnas que pasan por el driver llegan como `Date` y se serializan con `Z`.
  Sin formatearlos, la misma fecha llegaría escrita de dos formas distintas
  según viniera dentro de la categoría o fuera de ella, y no coincidiría con lo
  que devuelven los endpoints de categorías y de etiquetas. Por la misma razón
  `fecha_vencimiento` se proyecta como texto: es un `DATE`, y convertido a
  `Date` por el driver se desplazaría un día según la zona horaria.

- **2026-08-28 — La descripción rechaza el retorno de carro, y no solo los
  demás caracteres de control.** Es la lectura literal de la spec, que admite
  "saltos de línea" y rechaza "cualquier otro carácter de control". Consecuencia
  registrada para que conste: un `textarea` que envíe finales de línea CRLF
  recibirá `400`, así que el frontend deberá normalizarlos a `\n` antes de
  enviar. Se prefiere eso a normalizarlos en el servidor, que sería reescribir
  en silencio lo que llega y ablandaría una regla que la spec fija.
