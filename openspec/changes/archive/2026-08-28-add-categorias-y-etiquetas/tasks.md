## 1. Errores y validación compartidos

- [x] 1.1 Añadir `NOMBRE_DUPLICADO` al catálogo `CODIGOS_ERROR` de `backend/src/utils/errores.js` y un constructor `errorNombreDuplicado(recurso)` que devuelva un `ErrorAplicacion` de estado `409` con mensaje en español; verificar que el mensaje no menciona ninguna tabla, columna ni restricción de la base de datos
- [x] 1.2 Añadir a `backend/src/utils/validacion.js` una función `validarNombre(cuerpo, longitudMaxima)` que exija un nombre presente, de tipo texto, no vacío tras recortar espacios y dentro de la longitud indicada, devolviendo el mismo `{ valido, detalles, datos }` que las validaciones existentes; verificar con nombre ausente, `null`, número, cadena vacía, cadena de solo espacios y cadena de longitud máxima más uno que cada caso se rechaza, y que un nombre con espacios alrededor se devuelve ya recortado y con los espacios interiores intactos
- [x] 1.3 Hacer que `validarNombre` rechace cualquier nombre que contenga saltos de línea o caracteres de control, y que normalice el nombre a Unicode NFC antes de devolverlo; verificar que `"a
b"` y `"ab"` se rechazan con `400`, que `"café"` escrito en NFD sale igual byte a byte que escrito en NFC, y que un nombre con emojis o en alfabeto no latino se acepta sin alterarse
- [x] 1.4 Hacer que la longitud se cuente en puntos de código (`[...nombre].length`) y no en unidades UTF-16, para coincidir con el `char_length` del esquema; verificar que un nombre de 100 emojis se acepta para categorías —donde `.length` de JavaScript daría 200 y lo rechazaría— y que uno de 101 se rechaza con `400`
- [x] 1.5 Añadir un ayudante `parsearIdRuta(valor)` que acepte solo enteros positivos y lance `errorDatosInvalidos` en cualquier otro caso; verificar que rechaza `"abc"`, `"1.5"`, `"-1"`, `"0"` y la cadena vacía, y que acepta `"1"` y `"9007199254740993"` sin perder precisión al compararse después en la base

- [x] 1.6 Verificar que el manejador de errores ya existente traduce el cuerpo JSON ilegible de `express.json()` a `400 DATOS_INVALIDOS`, sin añadir nada nuevo; comprobarlo contra un `POST` de categorías con un cuerpo roto y confirmar que responde `400` y no `500`

## 2. Repositorio de categorías

- [x] 2.1 Crear `backend/src/repositorios/categoriasRepo.js` con la lista explícita de columnas públicas (`id, nombre, creado_en`) y la función de listado `SELECT ... WHERE usuario_id = $1 ORDER BY nombre`; verificar por inspección que no usa `SELECT *` y que ningún valor se concatena en la cadena SQL
- [x] 2.2 Añadir `insertarCategoria({ usuarioId, nombre })` con `INSERT ... RETURNING` de las columnas públicas, tomando `usuario_id` del parámetro y nunca del cuerpo de la petición; verificar contra la base con datos de prueba desechables que la fila creada queda asociada al usuario indicado, y eliminarlos al terminar
- [x] 2.3 Añadir `actualizarCategoria({ id, usuarioId, nombre })` como `UPDATE ... WHERE id = $2 AND usuario_id = $3 RETURNING` las columnas públicas, devolviendo `null` cuando no hay fila; verificar con datos de prueba desechables que actualizar el identificador de una categoría de otro usuario devuelve `null` y deja esa fila intacta
- [x] 2.4 Añadir `eliminarCategoria({ id, usuarioId })` como `DELETE ... WHERE id = $1 AND usuario_id = $2`, devolviendo si se eliminó alguna fila; verificar con datos de prueba desechables que borrar el identificador de una categoría ajena devuelve falso y que esa fila sigue existiendo
- [x] 2.5 Verificar que las cuatro funciones exigen `usuarioId` en su firma y que ninguna consulta del archivo carece de `usuario_id` en su cláusula `WHERE`

## 3. Repositorio de etiquetas

- [x] 3.1 Crear `backend/src/repositorios/etiquetasRepo.js` con las cuatro funciones simétricas a las de categorías (listar, insertar, actualizar, eliminar), con SQL literal propio y no generado a partir de un nombre de tabla parametrizado; verificar por inspección que cada consulta es una cadena literal con marcadores de parámetro
- [x] 3.2 Verificar contra la base con datos de prueba desechables que las cuatro funciones respetan la frontera de usuario igual que las de categorías —listar solo devuelve lo propio, actualizar y eliminar de otro usuario no afectan a ninguna fila— y eliminar los datos al terminar

## 4. Endpoints de categorías

- [x] 4.1 Crear `backend/src/controladores/categoriasControlador.js` con `listar`, `crear`, `actualizar` y `eliminar`, tomando siempre el identificador de usuario de `req.usuario.id` y delegando el formato de error al middleware mediante `siguiente(error)`; verificar por inspección que ningún controlador lee un identificador de usuario del cuerpo, de la query ni de la ruta
- [x] 4.2 Implementar la traducción del error `23505` inspeccionando `error.constraint`: solo `categorias_usuario_nombre_unico` se convierte en `errorNombreDuplicado`, y cualquier otra violación se propaga; verificar que la respuesta de conflicto no incluye el nombre de la restricción
- [x] 4.3 Hacer que `actualizar` y `eliminar` lancen `errorNoEncontrado` cuando el repositorio no devuelve fila, sin ninguna rama que distinga "no existe" de "es de otro usuario"; verificar por inspección que existe un único camino de código hacia ese `404`
- [x] 4.4 Crear `backend/src/rutas/categoriasRutas.js` con `GET /`, `POST /`, `PUT /:id` y `DELETE /:id`, y montarlo en `backend/src/app.js` como `app.use('/api/categorias', requiereAutenticacion, categoriasRutas)`; verificar que los cuatro endpoints responden `401` sin token, incluido uno añadido de prueba al router, para comprobar que la protección viene del montaje y no de cada ruta
- [x] 4.5 Verificar contra el servidor en marcha que `POST /api/categorias` con un nombre válido responde `201` con el identificador y el nombre, y que `GET /api/categorias` la devuelve
- [x] 4.6 Verificar que `POST /api/categorias` sin nombre, con nombre vacío, con nombre de solo espacios y con nombre de 101 caracteres responde `400` en los cuatro casos indicando el campo inválido, y que no crea ninguna categoría
- [x] 4.7 Verificar que crear una segunda categoría "trabajo" cuando ya existe "Trabajo" responde `409` con el código `NOMBRE_DUPLICADO`, y que sigue existiendo una sola categoría
- [x] 4.8 Verificar que `PUT /api/categorias/:id` renombra correctamente con `200`, que renombrar al nombre de otra categoría propia responde `409`, y que renombrar una categoría a su propio nombre actual responde `200` y no `409`
- [x] 4.9 Verificar que `DELETE /api/categorias/:id` responde `204` sin cuerpo, que la categoría desaparece del listado y que repetir el borrado responde `404`
- [x] 4.10 Verificar que `GET /api/categorias` de un usuario sin categorías responde `200` con una lista vacía, y que el listado llega ordenado por nombre ignorando mayúsculas

- [x] 4.11 Verificar que el cuerpo de las respuestas sigue el contrato acordado: `POST` y `PUT` devuelven el objeto directamente con `id`, `nombre` y `creado_en`, sin envoltorio; `GET` devuelve un array directamente y `[]` cuando no hay ninguna; y el `id` llega como cadena de texto en todos los casos
- [x] 4.12 Verificar que renombrar una categoría cambiando solo las mayúsculas responde `200` y que el listado posterior muestra la nueva grafía, no la anterior
- [x] 4.13 Verificar que crear una categoría con espacios alrededor la guarda recortada, que un nombre con salto de línea o carácter de control responde `400`, y que un nombre con emojis se acepta y se devuelve sin alterar
- [x] 4.14 Verificar que un nombre acentuado enviado en NFD colisiona con el mismo nombre ya existente en NFC y responde `409`, en lugar de crear dos categorías visualmente idénticas
- [x] 4.15 Verificar que un `POST` con campos desconocidos además del nombre los ignora y responde `201`, y que un `POST` con un cuerpo JSON roto responde `400` y nunca `500`

## 5. Endpoints de etiquetas

- [x] 5.1 Crear `backend/src/controladores/etiquetasControlador.js` simétrico al de categorías, con la longitud máxima de nombre propia de etiquetas y la traducción de `23505` acotada a `etiquetas_usuario_nombre_unico`; verificar por inspección que ningún controlador toma el identificador de usuario de la petición
- [x] 5.2 Crear `backend/src/rutas/etiquetasRutas.js` con los cuatro endpoints y montarlo en `app.js` como `app.use('/api/etiquetas', requiereAutenticacion, etiquetasRutas)`; verificar que los cuatro responden `401` sin token
- [x] 5.3 Verificar contra el servidor en marcha el ciclo completo de etiquetas —crear con `201`, listar con `200`, renombrar con `200`, eliminar con `204` y repetir el borrado con `404`— y que el listado llega ordenado por nombre
- [x] 5.4 Verificar que el nombre de etiqueta duplicado ignorando mayúsculas responde `409` con `NOMBRE_DUPLICADO`, y que un nombre de 51 caracteres responde `400`

- [x] 5.5 Verificar en etiquetas el mismo contrato de respuesta que en categorías —objeto directo con `id`, `nombre` y `creado_en`, listado como array, `id` como cadena— y que renombrar cambiando solo mayúsculas responde `200` y persiste la nueva grafía
- [x] 5.6 Verificar en etiquetas el recorte de espacios, el rechazo con `400` de saltos de línea y caracteres de control, la aceptación de emojis, y la colisión `409` entre el mismo nombre en NFC y en NFD

## 6. Aislamiento entre usuarios

- [x] 6.1 Registrar dos usuarios de prueba y crear con cada token una categoría "Trabajo" y una etiqueta "urgente"; verificar que ambas creaciones tienen éxito y que cada recurso pertenece a su dueño
- [x] 6.2 Verificar que el listado de categorías y el de etiquetas de cada usuario devuelven únicamente lo suyo, y que ningún recurso del otro usuario aparece en ninguna de las dos respuestas
- [x] 6.3 Verificar que `PUT` y `DELETE` sobre el identificador de una categoría del otro usuario responden `404` en los cuatro casos, y que la fila del otro usuario permanece con su nombre original
- [x] 6.4 Repetir la comprobación anterior con etiquetas y verificar además que las asociaciones de esa etiqueta a tareas siguen intactas
- [x] 6.5 Comparar la respuesta de operar sobre un identificador ajeno con la de operar sobre un identificador inexistente y verificar que coinciden en estado y en código de error, sin revelar que el recurso ajeno existe
- [x] 6.6 Verificar que enviar `usuario_id` en el cuerpo de un `POST` o de un `PUT` no tiene ningún efecto: el recurso queda o permanece asociado al usuario del token

## 7. Consecuencias del borrado

- [x] 7.1 Con datos de prueba desechables, insertar tareas asignadas a una categoría, eliminar la categoría por la API y verificar que las tareas siguen existiendo con el resto de sus datos sin cambios y con `categoria_id` a `NULL`; eliminar los datos al terminar
- [x] 7.2 Con datos de prueba desechables, asociar una etiqueta a dos tareas mediante inserciones directas en `tarea_etiquetas`, eliminar la etiqueta por la API y verificar que ambas tareas siguen existiendo, que sus filas de `tarea_etiquetas` con esa etiqueta han desaparecido y que las asociaciones a otras etiquetas se conservan; eliminar los datos al terminar
- [x] 7.3 Verificar que renombrar una etiqueta asociada a tareas conserva todas sus asociaciones

## 8. Verificación integral del cambio

- [x] 8.1 Verificar que cada uno de los ocho endpoints responde `401` sin token, con token manipulado y con token expirado, y que en ningún caso llega a ejecutarse la lógica del endpoint
- [x] 8.2 Verificar que un identificador de ruta mal formado (`abc`, `-1`, `1.5`) responde `400` y nunca `500`, y que la respuesta no contiene ningún mensaje del driver de base de datos
- [x] 8.3 Verificar que el identificador devuelto por la API se puede usar tal cual en la ruta de un `PUT` y de un `DELETE`, y que ninguna capa lo convierte a número por el camino
- [x] 8.4 Revisar el cuerpo de todas las respuestas de error producidas durante la verificación y comprobar que cada una trae un `codigo` estable en mayúsculas y un `mensaje` en español, sin trazas de pila ni nombres de tablas, columnas o restricciones
- [x] 8.5 Auditar `backend/src/` y verificar que todo el SQL nuevo vive en `src/repositorios/`, que ninguna consulta concatena valores ni nombres de tabla, y que toda consulta de categorías y etiquetas lleva `usuario_id` en su cláusula `WHERE`
- [x] 8.6 Verificar que no se ha añadido ninguna dependencia nueva a `backend/package.json` respecto al cambio anterior
- [x] 8.7 Ejecutar `openspec validate add-categorias-y-etiquetas --strict` y verificar que pasa sin errores
