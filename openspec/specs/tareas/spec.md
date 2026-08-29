## Purpose

Define cómo una persona autenticada gestiona sus propias tareas a través de la API —crearlas, consultarlas con filtros, editarlas, marcarlas como completadas y eliminarlas—, cómo se asocian a una categoría y a etiquetas suyas, y qué garantías de propiedad, validación y aislamiento rigen sobre todo ello.

## Requirements

### Requirement: Toda operación sobre tareas exige autenticación
Todos los endpoints de tareas MUST ser endpoints protegidos: exigen un JWT válido en la cabecera `Authorization` con el esquema `Bearer`. El sistema MUST determinar el usuario propietario exclusivamente a partir de ese token y MUST NOT aceptar ningún identificador de usuario enviado por el cliente en la ruta, en la query ni en el cuerpo de la petición.

#### Scenario: Petición sin autenticación válida
- **WHEN** se llama a cualquier endpoint de tareas sin token, o con un token inválido, manipulado o expirado
- **THEN** el sistema responde con estado `401` y no crea, modifica, elimina ni devuelve ninguna tarea

#### Scenario: Intento de suplantar al propietario
- **WHEN** una petición autenticada incluye además un identificador de usuario propio en el cuerpo o en la query
- **THEN** el sistema lo ignora por completo y atribuye la operación al usuario del token

### Requirement: Creación de una tarea
El sistema MUST permitir crear una tarea mediante `POST /api/tareas` aportando al menos su título. La descripción, la categoría, la fecha de vencimiento, la prioridad y las etiquetas son opcionales. La tarea creada MUST pertenecer al usuario del token, MUST nacer no completada y, si no se indica prioridad, MUST recibir la prioridad intermedia. La respuesta de éxito MUST devolver la tarea creada con su identificador.

#### Scenario: Creación solo con título
- **WHEN** un usuario autenticado crea una tarea aportando únicamente un título válido
- **THEN** el sistema responde con estado `201` y devuelve la tarea con su identificador, su título, su descripción vacía, su categoría vacía, su fecha de vencimiento vacía, prioridad `media`, `completada` en falso y sin etiquetas

#### Scenario: Creación con todos los campos
- **WHEN** un usuario autenticado crea una tarea con título, descripción, categoría propia, fecha de vencimiento, prioridad y etiquetas propias
- **THEN** el sistema responde con estado `201` y devuelve la tarea con todos esos datos, su categoría y sus etiquetas incluidas

#### Scenario: Título ausente, vacío o fuera de la longitud admitida
- **WHEN** la petición no incluye título, lo envía vacío o solo con espacios, o excede la longitud máxima admitida
- **THEN** el sistema responde con estado `400` indicando qué campo es inválido, y no crea ninguna tarea

#### Scenario: Prioridad fuera del conjunto admitido
- **WHEN** la petición envía una prioridad que no es `baja`, `media` ni `alta`
- **THEN** el sistema responde con estado `400` indicando que la prioridad es inválida, y no crea ninguna tarea

#### Scenario: Fecha de vencimiento mal formada
- **WHEN** la petición envía una fecha de vencimiento que no expresa un día del calendario válido
- **THEN** el sistema responde con estado `400` indicando que la fecha es inválida, y no crea ninguna tarea

#### Scenario: Fecha de vencimiento en el pasado
- **WHEN** un usuario crea o edita una tarea con una fecha de vencimiento anterior al día de hoy
- **THEN** la operación tiene éxito y la tarea conserva esa fecha, porque registrar algo ya atrasado es un uso válido

### Requirement: Normalización y caracteres admitidos en el título y la descripción
El sistema MUST recortar los espacios de los extremos del título y de la descripción antes de validarlos y guardarlos, y MUST conservar tal cual los espacios interiores. Ambos MUST normalizarse a la forma Unicode NFC antes de guardarse. El título MUST rechazarse si contiene saltos de línea o cualquier otro carácter de control; la descripción MUST admitir saltos de línea y MUST rechazarse si contiene cualquier otro carácter de control. La longitud máxima de ambos MUST contarse en caracteres tal como los percibe la persona, de forma coherente con el límite que impone el almacenamiento. Ambos MUST admitir cualquier otro carácter, incluidos acentos, alfabetos no latinos y emojis.

#### Scenario: Espacios alrededor del título o de la descripción
- **WHEN** un usuario crea una tarea cuyo título o cuya descripción llevan espacios al principio o al final
- **THEN** la tarea se guarda con esos textos ya recortados, con sus espacios interiores intactos, y así los devuelven las consultas posteriores

#### Scenario: Título que queda vacío tras recortar
- **WHEN** la petición envía un título formado solo por espacios
- **THEN** el sistema responde con estado `400` y no crea ni modifica ninguna tarea

#### Scenario: Salto de línea en el título
- **WHEN** la petición envía un título que contiene un salto de línea o un carácter de control
- **THEN** el sistema responde con estado `400` y no crea ni modifica ninguna tarea

#### Scenario: Salto de línea en la descripción
- **WHEN** un usuario crea una tarea cuya descripción contiene varios párrafos separados por saltos de línea
- **THEN** la creación tiene éxito y la descripción se conserva con sus saltos de línea

#### Scenario: Carácter de control distinto del salto de línea en la descripción
- **WHEN** la petición envía una descripción que contiene un carácter de control que no es un salto de línea
- **THEN** el sistema responde con estado `400` y no crea ni modifica ninguna tarea

#### Scenario: Título con emojis o alfabetos no latinos
- **WHEN** un usuario crea una tarea cuyo título contiene emojis o caracteres de un alfabeto no latino, dentro de la longitud admitida
- **THEN** la creación tiene éxito y el título se conserva exactamente como se envió, sin que la longitud se cuente de forma distinta a como la cuenta el almacenamiento

### Requirement: Forma de la representación de una tarea
Una tarea MUST representarse siempre con el mismo conjunto de campos —su identificador, su título, su descripción, su categoría, su fecha de vencimiento, su prioridad, si está completada, sus etiquetas, su fecha de creación, su fecha de última modificación y su instante de finalización— tanto al crearla como al editarla, al cambiar su estado de completada o al listarla. El identificador MUST viajar como cadena de texto, porque es un entero de 64 bits cuyo valor puede exceder la precisión de un número en JSON. La categoría MUST viajar como objeto con la misma forma que devuelven los endpoints de categorías, o vacía si la tarea no tiene ninguna; las etiquetas MUST viajar como un array de objetos con la misma forma que devuelven los endpoints de etiquetas, vacío si la tarea no tiene ninguna. Las operaciones sobre una tarea concreta MUST devolver el objeto directamente, sin envoltorio, y el listado MUST devolver un array directamente.

#### Scenario: Los mismos campos en todas las respuestas
- **WHEN** un usuario crea una tarea, la edita, cambia su estado de completada y después consulta su listado
- **THEN** la tarea aparece en las cuatro respuestas con el mismo conjunto de campos, y su identificador y su fecha de creación son los mismos en todas ellas

#### Scenario: Categoría y etiquetas embebidas
- **WHEN** se consulta una tarea que tiene categoría y etiquetas
- **THEN** su categoría llega como objeto con identificador, nombre y fecha de creación, y sus etiquetas llegan como array de objetos con esos mismos campos, sin que el cliente necesite otra petición para conocer sus nombres

#### Scenario: Tarea sin categoría y sin etiquetas
- **WHEN** se consulta una tarea que no tiene categoría ni etiquetas
- **THEN** su categoría llega vacía y sus etiquetas llegan como array vacío, nunca ausentes ni nulas de forma distinta al resto de tareas

#### Scenario: El identificador no pierde precisión
- **WHEN** el cliente recibe el identificador de una tarea y lo usa tal cual en la ruta de una edición, de un cambio de estado o de un borrado
- **THEN** la operación alcanza exactamente esa tarea, sin que ningún identificador se confunda con otro por redondeo

### Requirement: La categoría de una tarea debe pertenecer al mismo usuario
Cuando una petición de creación o de edición envía una categoría, esa categoría MUST pertenecer al usuario del token. Si la categoría no existe o pertenece a otro usuario, el sistema MUST responder con estado `400` y un código de error estable de referencia inválida, y MUST NOT crear ni modificar ninguna tarea. La respuesta MUST NOT permitir distinguir una categoría ajena de una que no existe.

#### Scenario: Categoría propia
- **WHEN** un usuario crea o edita una tarea indicando una categoría suya
- **THEN** la operación tiene éxito y la tarea queda asociada a esa categoría

#### Scenario: Categoría de otro usuario o inexistente
- **WHEN** un usuario crea o edita una tarea indicando una categoría que no existe o que pertenece a otro usuario
- **THEN** el sistema responde con estado `400` con el código de referencia inválida, no crea ni modifica ninguna tarea, y ambos casos producen la misma respuesta

#### Scenario: Tarea sin categoría
- **WHEN** un usuario crea o edita una tarea sin indicar categoría, o indicándola vacía
- **THEN** la operación tiene éxito y la tarea queda sin categoría

### Requirement: Las etiquetas de una tarea deben pertenecer al mismo usuario y se aplican como un todo
Cuando una petición de creación o de edición envía etiquetas, cada una MUST pertenecer al usuario del token. Si alguna no existe o pertenece a otro usuario, la operación completa MUST fallar con estado `400` y el código estable de referencia inválida, y el sistema MUST NOT aplicar ninguna de las asociaciones enviadas ni modificar la tarea en ningún otro aspecto. La lista enviada MUST sustituir por completo el conjunto de etiquetas de la tarea. Repetir el mismo identificador de etiqueta en la lista MUST NOT producir una asociación duplicada.

#### Scenario: Etiquetas propias
- **WHEN** un usuario crea o edita una tarea indicando etiquetas suyas
- **THEN** la operación tiene éxito y la tarea queda exactamente con esas etiquetas

#### Scenario: Una sola etiqueta ajena invalida toda la operación
- **WHEN** un usuario envía tres etiquetas de las cuales dos son suyas y una pertenece a otro usuario
- **THEN** el sistema responde con estado `400`, la tarea no se crea ni se modifica, y ninguna de las tres asociaciones queda escrita

#### Scenario: La lista sustituye el conjunto anterior
- **WHEN** un usuario edita una tarea que tenía dos etiquetas enviando una lista con una sola etiqueta suya
- **THEN** la tarea queda con esa única etiqueta y la anterior deja de estar asociada, sin que la etiqueta desasociada se elimine

#### Scenario: Lista de etiquetas vacía
- **WHEN** un usuario edita una tarea que tenía etiquetas enviando una lista vacía
- **THEN** la tarea queda sin ninguna etiqueta, y todas las etiquetas siguen existiendo

#### Scenario: Etiquetas omitidas en la edición
- **WHEN** un usuario edita una tarea sin incluir el campo de etiquetas en la petición
- **THEN** las etiquetas de la tarea quedan como estaban

#### Scenario: Identificador de etiqueta repetido
- **WHEN** la petición envía dos veces el identificador de la misma etiqueta
- **THEN** la operación tiene éxito y la tarea presenta esa etiqueta una sola vez

### Requirement: Edición de una tarea
El sistema MUST permitir editar una tarea propia mediante `PUT /api/tareas/:id`. La edición MUST sustituir el contenido de la tarea: un campo opcional omitido queda vacío, salvo las etiquetas, cuya omisión conserva las actuales. La edición MUST NOT permitir cambiar el usuario propietario de la tarea ni su estado de completada, que solo cambia por su endpoint propio. La respuesta de éxito MUST devolver la tarea ya modificada.

#### Scenario: Edición correcta
- **WHEN** un usuario autenticado edita una tarea suya con datos válidos
- **THEN** el sistema responde con estado `200`, devuelve la tarea ya modificada, y esos son los datos que aparecen en consultas posteriores

#### Scenario: Campo opcional omitido en la edición
- **WHEN** un usuario edita una tarea que tenía descripción, categoría y fecha de vencimiento enviando solo el título
- **THEN** la tarea queda con ese título y con la descripción, la categoría y la fecha de vencimiento vacías

#### Scenario: Intento de cambiar el estado de completada desde la edición
- **WHEN** una petición de edición incluye el campo de completada o el estado de la tarea
- **THEN** el sistema lo ignora y el estado de la tarea queda como estaba

#### Scenario: Datos inválidos en la edición
- **WHEN** la petición de edición no incluye título, lo envía vacío, excede la longitud admitida, o envía una prioridad o una fecha inválidas
- **THEN** el sistema responde con estado `400` y la tarea no se modifica

### Requirement: Marcar una tarea como completada o no completada
El sistema MUST exponer `PATCH /api/tareas/:id/completar`, que recibe en el cuerpo el estado deseado de forma explícita y lo aplica. El endpoint MUST NOT alternar el estado a partir del que la tarea tenga: repetir la misma petición MUST dejar la tarea en el mismo estado. Al pasar a completada, el sistema MUST registrar el instante en que ocurre; al pasar a no completada, MUST vaciarlo.

#### Scenario: Marcar como completada
- **WHEN** un usuario envía el estado de completada en verdadero para una tarea suya que no lo estaba
- **THEN** el sistema responde con estado `200`, devuelve la tarea con completada en verdadero, y su instante de finalización queda registrado

#### Scenario: Marcar como no completada
- **WHEN** un usuario envía el estado de completada en falso para una tarea suya que estaba completada
- **THEN** el sistema responde con estado `200`, devuelve la tarea con completada en falso, y su instante de finalización queda vacío

#### Scenario: Repetir la misma petición
- **WHEN** un usuario envía dos veces seguidas el estado de completada en verdadero para la misma tarea
- **THEN** ambas respuestas son `200` y la tarea queda completada en los dos casos, sin alternar al estado contrario

#### Scenario: Estado ausente o no booleano
- **WHEN** la petición no incluye el estado deseado, o lo envía con un valor que no es verdadero ni falso
- **THEN** el sistema responde con estado `400` indicando qué campo es inválido, y la tarea no cambia de estado

### Requirement: Eliminación de una tarea
El sistema MUST permitir eliminar una tarea propia mediante `DELETE /api/tareas/:id`. La eliminación MUST retirar también los vínculos entre esa tarea y sus etiquetas, sin dejar referencias huérfanas, y MUST NOT eliminar ni modificar la categoría ni las etiquetas en sí, que siguen existiendo para otras tareas.

#### Scenario: Eliminación correcta
- **WHEN** un usuario autenticado elimina una tarea suya
- **THEN** el sistema responde con estado `204` sin cuerpo, y la tarea deja de aparecer en su listado

#### Scenario: Eliminación de una tarea con categoría y etiquetas
- **WHEN** se elimina una tarea que tiene una categoría asignada y varias etiquetas asociadas
- **THEN** la categoría y las etiquetas siguen existiendo sin cambios y siguen apareciendo en sus listados, y ningún vínculo con la tarea eliminada permanece

#### Scenario: Eliminación repetida
- **WHEN** se intenta eliminar de nuevo una tarea ya eliminada
- **THEN** el sistema responde con estado `404`

### Requirement: Una tarea ajena se comporta como inexistente
Cuando un usuario intenta editar, cambiar el estado de completada o eliminar una tarea que no le pertenece, el sistema MUST responder con estado `404` y MUST NOT responder `403` ni ningún otro estado que permita distinguir una tarea ajena de un identificador que no existe. La operación MUST NOT modificar dato alguno.

#### Scenario: Edición de una tarea de otro usuario
- **WHEN** un usuario intenta editar una tarea cuyo dueño es otro usuario
- **THEN** el sistema responde con estado `404` y la tarea del otro usuario permanece intacta

#### Scenario: Cambio de estado de una tarea de otro usuario
- **WHEN** un usuario intenta marcar como completada una tarea cuyo dueño es otro usuario
- **THEN** el sistema responde con estado `404` y el estado de esa tarea no cambia

#### Scenario: Eliminación de una tarea de otro usuario
- **WHEN** un usuario intenta eliminar una tarea cuyo dueño es otro usuario
- **THEN** el sistema responde con estado `404` y la tarea del otro usuario sigue existiendo

#### Scenario: Indistinguibilidad respecto a un identificador inexistente
- **WHEN** un usuario opera sobre el identificador de una tarea ajena y sobre un identificador que no existe en el sistema
- **THEN** ambas respuestas son equivalentes en estado y en código de error, y ninguna revela que la tarea ajena existe

### Requirement: Listado de las tareas propias
El sistema MUST exponer `GET /api/tareas`, que devuelve todas las tareas del usuario del token y solo ellas. La respuesta MUST NOT incluir ninguna tarea de otro usuario bajo ninguna combinación de parámetros. Sin parámetros, el listado MUST devolver todas las tareas del usuario ordenadas por fecha de creación descendente.

#### Scenario: Usuario con tareas
- **WHEN** un usuario autenticado consulta sus tareas sin parámetros
- **THEN** el sistema responde con estado `200` y devuelve todas sus tareas, cada una con su categoría y sus etiquetas, ordenadas de la más reciente a la más antigua

#### Scenario: Usuario sin tareas
- **WHEN** un usuario que no ha creado ninguna tarea consulta el listado
- **THEN** el sistema responde con estado `200` y una lista vacía, no un error

#### Scenario: Aislamiento entre usuarios
- **WHEN** dos usuarios que tienen tareas consultan el listado con sus respectivos tokens
- **THEN** cada uno recibe únicamente sus propias tareas, y ninguna tarea aparece en la respuesta de quien no es su dueño

### Requirement: Filtrado del listado de tareas
El listado MUST admitir los filtros `completada`, `categoria`, `prioridad`, `fecha_vencimiento_desde`, `fecha_vencimiento_hasta`, `busqueda` y `etiquetas`. Todos los filtros MUST ser opcionales y MUST combinarse entre sí como conjunción: una tarea aparece en el resultado solo si cumple todos los filtros enviados. Salvo `etiquetas`, que es una lista por su propia naturaleza, cada filtro MUST admitir un único valor. El filtro `categoria` MUST admitir además el valor reservado `ninguna`, que restringe el resultado a las tareas sin categoría. Todo filtro MUST aplicarse siempre dentro de las tareas del usuario del token, de modo que ninguna combinación pueda devolver una tarea ajena.

#### Scenario: Filtro por estado de completada
- **WHEN** un usuario consulta su listado filtrando por tareas no completadas
- **THEN** el resultado incluye todas sus tareas no completadas y ninguna completada

#### Scenario: Filtro por categoría
- **WHEN** un usuario consulta su listado filtrando por una categoría suya
- **THEN** el resultado incluye solo sus tareas asociadas a esa categoría

#### Scenario: Filtro por las tareas sin categoría
- **WHEN** un usuario consulta su listado filtrando la categoría por el valor reservado que designa la ausencia de categoría
- **THEN** el resultado incluye solo sus tareas que no tienen categoría, y ninguna de las que sí la tienen

#### Scenario: Filtro por prioridad
- **WHEN** un usuario consulta su listado filtrando por prioridad alta
- **THEN** el resultado incluye solo sus tareas de prioridad alta

#### Scenario: Filtro por rango de fecha de vencimiento
- **WHEN** un usuario consulta su listado indicando una fecha de inicio y una de fin de rango
- **THEN** el resultado incluye solo sus tareas cuya fecha de vencimiento cae dentro del rango, incluidos ambos extremos, y ninguna tarea sin fecha de vencimiento

#### Scenario: Un solo extremo del rango
- **WHEN** un usuario consulta su listado indicando únicamente la fecha de inicio del rango
- **THEN** el resultado incluye solo sus tareas cuya fecha de vencimiento es esa o posterior, sin límite superior

#### Scenario: Filtro por etiquetas
- **WHEN** un usuario consulta su listado indicando dos nombres de etiqueta
- **THEN** el resultado incluye solo sus tareas que tienen ambas etiquetas, y no las que tienen solo una

#### Scenario: Nombres de etiqueta en otra caja
- **WHEN** un usuario filtra por el nombre de una etiqueta suya escrito con otras mayúsculas y minúsculas
- **THEN** el filtro reconoce la etiqueta y devuelve las mismas tareas que con la grafía original

#### Scenario: Filtros combinados
- **WHEN** un usuario consulta su listado filtrando a la vez por prioridad alta y por tareas no completadas
- **THEN** el resultado incluye solo las tareas que cumplen ambas condiciones, no las que cumplen solo una

#### Scenario: Filtro que no encuentra nada
- **WHEN** una combinación de filtros no deja ninguna tarea
- **THEN** el sistema responde con estado `200` y una lista vacía, no un error

#### Scenario: Filtro por una categoría o una etiqueta de otro usuario
- **WHEN** un usuario filtra su listado por el identificador de una categoría ajena o por el nombre de una etiqueta que solo tiene otro usuario
- **THEN** el resultado es una lista vacía, y en ningún caso aparece una tarea de otro usuario

### Requirement: Búsqueda por texto en el listado de tareas
El listado MUST admitir el parámetro `busqueda`, que restringe el resultado a las tareas del usuario cuyo título o descripción coinciden con el texto buscado. La búsqueda MUST ignorar las diferencias de mayúsculas y minúsculas y las de acentuación, y MUST reconocer variantes flexivas de una misma palabra en español. Un texto de búsqueda arbitrario MUST NOT producir nunca un error: cualquier cadena que una persona teclee es una búsqueda válida. Una `busqueda` vacía o formada solo por espacios MUST tratarse como si el parámetro no se hubiera enviado, y MUST NOT rechazarse.

#### Scenario: Coincidencia en el título
- **WHEN** un usuario busca una palabra que aparece en el título de una de sus tareas
- **THEN** el resultado incluye esa tarea

#### Scenario: Coincidencia en la descripción
- **WHEN** un usuario busca una palabra que aparece solo en la descripción de una de sus tareas
- **THEN** el resultado incluye esa tarea

#### Scenario: Diferencias de caja y de acentos
- **WHEN** un usuario busca un término escrito sin acentos y en minúsculas cuyo original aparece acentuado y capitalizado
- **THEN** el resultado incluye igualmente esa tarea

#### Scenario: Variante flexiva de la palabra
- **WHEN** un usuario busca una palabra en una forma distinta a la que aparece escrita en su tarea, siendo la misma palabra
- **THEN** el resultado incluye esa tarea

#### Scenario: Búsqueda vacía
- **WHEN** un usuario consulta su listado enviando el parámetro de búsqueda vacío o con solo espacios, como hace un cuadro de búsqueda al que se le ha borrado el texto
- **THEN** el sistema responde con estado `200` y devuelve el mismo resultado que si no se hubiera enviado el parámetro, nunca un error

#### Scenario: Texto de búsqueda con signos de puntuación u operadores
- **WHEN** un usuario busca una cadena que contiene signos de puntuación, comillas o símbolos sueltos
- **THEN** el sistema responde con estado `200` y un resultado, nunca con un error

#### Scenario: Búsqueda combinada con otros filtros
- **WHEN** un usuario busca un texto y a la vez filtra por prioridad
- **THEN** el resultado incluye solo las tareas que coinciden con el texto y además tienen esa prioridad

#### Scenario: La búsqueda no cruza la frontera de usuario
- **WHEN** un usuario busca un texto que aparece en una tarea de otro usuario
- **THEN** esa tarea no aparece en el resultado

### Requirement: Ordenación del listado de tareas
El listado MUST admitir los parámetros `ordenar` y `direccion`. `ordenar` MUST admitir únicamente `creado_en`, `fecha_vencimiento`, `prioridad` y `titulo`, y `direccion` únicamente `asc` y `desc`. Sin ningún parámetro, el orden MUST ser por fecha de creación descendente. Cuando se indica `ordenar` sin `direccion`, la dirección MUST ser la que resulta útil para ese campo: descendente para `creado_en` y para `prioridad`, ascendente para `titulo` y para `fecha_vencimiento`. Una `direccion` explícita MUST prevalecer siempre sobre ese valor por defecto. El orden MUST ser estable: dos consultas idénticas MUST devolver las mismas tareas en el mismo orden. Al ordenar por prioridad, el orden MUST ser el de negocio —alta, media, baja— y no el alfabético. Al ordenar por fecha de vencimiento, las tareas sin fecha MUST quedar al final del resultado en ambas direcciones.

#### Scenario: Orden por defecto
- **WHEN** un usuario consulta su listado sin indicar orden
- **THEN** las tareas llegan de la más reciente a la más antigua por fecha de creación

#### Scenario: Dirección por defecto de cada campo
- **WHEN** un usuario pide ordenar por cada uno de los campos admitidos sin indicar dirección
- **THEN** por fecha de creación llegan de la más reciente a la más antigua, por prioridad las más urgentes primero, por título de la A a la Z, y por fecha de vencimiento las que vencen antes primero

#### Scenario: Dirección explícita contraria a la de por defecto
- **WHEN** un usuario pide ordenar por título indicando expresamente la dirección descendente
- **THEN** las tareas llegan de la Z a la A, porque la dirección enviada prevalece sobre la de por defecto

#### Scenario: Orden por título ascendente
- **WHEN** un usuario pide ordenar por título en dirección ascendente
- **THEN** las tareas llegan ordenadas alfabéticamente por su título

#### Scenario: Orden por prioridad
- **WHEN** un usuario pide ordenar por prioridad en dirección descendente
- **THEN** las tareas de prioridad alta llegan antes que las de prioridad media, y estas antes que las de prioridad baja

#### Scenario: Orden por fecha de vencimiento con tareas sin fecha
- **WHEN** un usuario pide ordenar por fecha de vencimiento y tiene tareas con fecha y tareas sin ella
- **THEN** las tareas con fecha llegan ordenadas entre sí y las que no tienen fecha llegan al final, tanto en dirección ascendente como descendente

#### Scenario: Orden estable ante valores iguales
- **WHEN** un usuario con varias tareas que comparten el mismo valor en el campo de ordenación consulta el listado dos veces seguidas
- **THEN** ambas respuestas devuelven esas tareas en el mismo orden

#### Scenario: Ordenación combinada con filtros
- **WHEN** un usuario filtra su listado y a la vez pide un orden
- **THEN** el orden se aplica sobre el resultado ya filtrado

### Requirement: Los parámetros de consulta inválidos se rechazan explícitamente
Cuando el listado recibe un valor no admitido en cualquiera de sus parámetros, el sistema MUST responder con estado `400` y el código estable de datos inválidos, señalando qué parámetro es inválido. El sistema MUST NOT ignorar el parámetro en silencio, MUST NOT devolver un resultado como si el parámetro no se hubiera enviado y MUST NOT responder con un error interno. La única excepción es la `busqueda` vacía, que la especificación de la búsqueda define como ausencia de valor y no como valor inválido.

El sistema MUST acotar además el tamaño de la entrada: MUST rechazar un texto de `busqueda` que exceda la longitud de un título, y MUST rechazar una lista de etiquetas —tanto la del filtro como la del cuerpo de una creación o de una edición— que exceda el número máximo de elementos admitido. Estos topes MUST NOT limitar cuántas tareas puede tener un usuario, que MUST seguir siendo ilimitado.

#### Scenario: Campo de ordenación no admitido
- **WHEN** un usuario pide ordenar por un campo que no está entre los admitidos
- **THEN** el sistema responde con estado `400` señalando el parámetro de ordenación, y no devuelve ninguna lista

#### Scenario: Dirección de ordenación no admitida
- **WHEN** un usuario envía una dirección de ordenación que no es ascendente ni descendente
- **THEN** el sistema responde con estado `400` señalando el parámetro de dirección

#### Scenario: Prioridad no admitida en el filtro
- **WHEN** un usuario filtra por una prioridad que no pertenece al conjunto admitido
- **THEN** el sistema responde con estado `400` señalando el parámetro de prioridad

#### Scenario: Valor de completada no booleano
- **WHEN** un usuario envía en el filtro de completada un valor que no representa ni verdadero ni falso
- **THEN** el sistema responde con estado `400` señalando ese parámetro

#### Scenario: Fecha de rango mal formada
- **WHEN** un usuario envía en un extremo del rango un valor que no expresa un día del calendario válido
- **THEN** el sistema responde con estado `400` señalando ese parámetro

#### Scenario: Identificador de categoría mal formado en el filtro
- **WHEN** un usuario filtra por un identificador de categoría que no tiene la forma de un identificador
- **THEN** el sistema responde con estado `400` señalando ese parámetro, sin filtrar ningún detalle interno del almacenamiento

#### Scenario: Varios valores en un filtro de valor único
- **WHEN** un usuario envía dos valores a la vez en el filtro de prioridad
- **THEN** el sistema responde con estado `400` señalando ese parámetro, y no devuelve un resultado tomando en cuenta solo uno de los dos

#### Scenario: Texto de búsqueda desmesurado
- **WHEN** un usuario envía un texto de búsqueda más largo que la longitud máxima de un título
- **THEN** el sistema responde con estado `400` señalando ese parámetro

#### Scenario: Lista de etiquetas desmesurada
- **WHEN** una petición envía en el filtro o en el cuerpo una lista de etiquetas con más elementos de los admitidos
- **THEN** el sistema responde con estado `400` señalando ese campo, y no crea ni modifica ninguna tarea

#### Scenario: Parámetros desconocidos
- **WHEN** la consulta incluye parámetros que el endpoint no reconoce
- **THEN** el sistema los ignora, no responde error por su presencia, y aplica los parámetros que sí reconoce

### Requirement: Errores consistentes en los endpoints de tareas
Toda respuesta de error de los endpoints de tareas MUST seguir el formato de error de la API, con un código de error estable independiente del texto y un mensaje en español, y MUST NOT exponer trazas de pila, mensajes del driver de base de datos ni nombres de tablas, columnas o restricciones.

#### Scenario: Referencia inválida a categoría o etiqueta
- **WHEN** el sistema rechaza una creación o una edición porque la categoría o alguna etiqueta no es del usuario
- **THEN** la respuesta incluye el código estable propio de esa causa y un mensaje en español que no menciona ninguna restricción ni tabla de la base de datos, y no revela si la referencia existe

#### Scenario: Cuerpo de la petición ilegible
- **WHEN** una petición de creación, de edición o de cambio de estado envía un cuerpo que no es JSON válido
- **THEN** el sistema responde con estado `400` y el código estable de datos inválidos, y nunca con un error interno

#### Scenario: Campos desconocidos en el cuerpo
- **WHEN** una petición de creación o de edición incluye campos que el endpoint no reconoce
- **THEN** el sistema los ignora, no responde error por su presencia, y la tarea queda con los datos que el endpoint sí reconoce

#### Scenario: Identificador de tarea mal formado
- **WHEN** se envía en la ruta un identificador que no tiene la forma de un identificador de tarea
- **THEN** el sistema responde con un error de datos inválidos o de recurso no encontrado, sin filtrar ningún detalle interno del almacenamiento
