## Purpose

Define cómo una persona autenticada gestiona sus propias etiquetas a través de la API —crearlas, consultarlas, renombrarlas y eliminarlas— y qué garantías de propiedad, unicidad y aislamiento rigen sobre ellas, incluyendo qué ocurre con los vínculos a tareas cuando una etiqueta desaparece.

## Requirements

### Requirement: Toda operación sobre etiquetas exige autenticación
Todos los endpoints de etiquetas MUST ser endpoints protegidos: exigen un JWT válido en la cabecera `Authorization` con el esquema `Bearer`. El sistema MUST determinar el usuario propietario exclusivamente a partir de ese token y MUST NOT aceptar ningún identificador de usuario enviado por el cliente en la ruta, en la query ni en el cuerpo de la petición.

#### Scenario: Petición sin autenticación válida
- **WHEN** se llama a cualquier endpoint de etiquetas sin token, o con un token inválido, manipulado o expirado
- **THEN** el sistema responde con estado `401` y no crea, modifica, elimina ni devuelve ninguna etiqueta

#### Scenario: Intento de suplantar al propietario
- **WHEN** una petición autenticada incluye además un identificador de usuario propio en el cuerpo o en la query
- **THEN** el sistema lo ignora por completo y atribuye la operación al usuario del token

### Requirement: Creación de una etiqueta
El sistema MUST permitir crear una etiqueta mediante `POST /api/etiquetas` aportando su nombre. La etiqueta creada MUST pertenecer al usuario del token. La respuesta de éxito MUST devolver la etiqueta creada con su identificador.

#### Scenario: Creación correcta
- **WHEN** un usuario autenticado envía un nombre válido que aún no usa en ninguna de sus etiquetas
- **THEN** el sistema responde con estado `201`, devuelve la etiqueta creada con su identificador, su nombre y su fecha de creación, y la etiqueta queda asociada a ese usuario

#### Scenario: Nombre ausente, vacío o fuera de la longitud admitida
- **WHEN** la petición no incluye nombre, lo envía vacío o solo con espacios, o excede la longitud máxima admitida para una etiqueta
- **THEN** el sistema responde con estado `400` indicando qué campo es inválido, y no crea ninguna etiqueta

### Requirement: Forma de la representación de una etiqueta
Una etiqueta MUST representarse siempre con los mismos campos —su identificador, su nombre y su fecha de creación— tanto al crearla como al editarla o al listarla. El identificador MUST viajar como cadena de texto, porque es un entero de 64 bits cuyo valor puede exceder la precisión de un número en JSON. Las operaciones sobre una etiqueta concreta MUST devolver el objeto directamente, sin envoltorio, y el listado MUST devolver un array directamente.

#### Scenario: Los mismos campos en creación, edición y listado
- **WHEN** un usuario crea una etiqueta, la renombra y después consulta su listado
- **THEN** la etiqueta aparece en las tres respuestas con el mismo conjunto de campos, y su identificador y su fecha de creación son los mismos en todas ellas

#### Scenario: El identificador no pierde precisión
- **WHEN** el cliente recibe el identificador de una etiqueta y lo usa tal cual en la ruta de una edición o de un borrado
- **THEN** la operación alcanza exactamente esa etiqueta, sin que ningún identificador se confunda con otro por redondeo

### Requirement: El nombre de una etiqueta es único dentro de cada usuario
Un usuario MUST NOT poder tener dos etiquetas con el mismo nombre, ignorando las diferencias de mayúsculas y minúsculas. Dos usuarios distintos MUST poder tener cada uno una etiqueta con el mismo nombre sin conflicto entre ellos.

#### Scenario: Nombre ya usado por el mismo usuario
- **WHEN** un usuario que ya tiene una etiqueta "urgente" intenta crear otra llamada "Urgente"
- **THEN** el sistema responde con estado `409` con un código de error estable, no crea la etiqueta, y la existente permanece intacta

#### Scenario: Mismo nombre en usuarios distintos
- **WHEN** dos usuarios distintos crean cada uno una etiqueta "urgente"
- **THEN** ambas creaciones tienen éxito y cada etiqueta pertenece únicamente a su dueño

### Requirement: Normalización y caracteres admitidos en el nombre
El sistema MUST recortar los espacios de los extremos del nombre antes de validarlo y guardarlo, y MUST conservar tal cual los espacios interiores. El nombre MUST normalizarse a la forma Unicode NFC antes de guardarse, de modo que dos nombres que se ven idénticos no puedan coexistir como etiquetas distintas. El sistema MUST rechazar un nombre que contenga saltos de línea o caracteres de control, y MUST admitir cualquier otro carácter, incluidos acentos, alfabetos no latinos y emojis. La longitud máxima MUST contarse en caracteres tal como los percibe la persona, de forma coherente con el límite que impone el almacenamiento.

#### Scenario: Espacios alrededor del nombre
- **WHEN** un usuario crea una etiqueta cuyo nombre lleva espacios al principio o al final
- **THEN** la etiqueta se guarda con el nombre ya recortado, y ese nombre recortado es el que devuelven las consultas posteriores

#### Scenario: Nombres equivalentes tras la normalización
- **WHEN** un usuario que ya tiene una etiqueta con un nombre acentuado intenta crear otra cuyo nombre se ve exactamente igual pero está escrito con una composición Unicode distinta
- **THEN** el sistema responde con estado `409`, porque para una persona son el mismo nombre

#### Scenario: Nombre con un salto de línea o un carácter de control
- **WHEN** la petición envía un nombre que contiene un salto de línea o un carácter de control
- **THEN** el sistema responde con estado `400` y no crea ni modifica ninguna etiqueta

#### Scenario: Nombre con emojis o alfabetos no latinos
- **WHEN** un usuario crea una etiqueta cuyo nombre contiene emojis o caracteres de un alfabeto no latino, dentro de la longitud admitida
- **THEN** la creación tiene éxito y el nombre se conserva exactamente como se envió

### Requirement: Listado de las etiquetas propias
El sistema MUST exponer `GET /api/etiquetas`, que devuelve todas las etiquetas del usuario del token y solo ellas, ordenadas por nombre. La respuesta MUST NOT incluir ninguna etiqueta de otro usuario.

#### Scenario: Usuario con etiquetas
- **WHEN** un usuario autenticado consulta sus etiquetas
- **THEN** el sistema responde con estado `200` y devuelve la lista de sus etiquetas ordenada por nombre, cada una con su identificador, su nombre y su fecha de creación

#### Scenario: Usuario sin etiquetas
- **WHEN** un usuario que no ha creado ninguna etiqueta consulta el listado
- **THEN** el sistema responde con estado `200` y una lista vacía, no un error

#### Scenario: Aislamiento entre usuarios
- **WHEN** dos usuarios que tienen etiquetas consultan el listado con sus respectivos tokens
- **THEN** cada uno recibe únicamente sus propias etiquetas, y ninguna etiqueta aparece en la respuesta de quien no es su dueño

### Requirement: Edición del nombre de una etiqueta
El sistema MUST permitir renombrar una etiqueta propia mediante `PUT /api/etiquetas/:id`. La respuesta de éxito MUST devolver la etiqueta con su nombre ya modificado. La edición MUST NOT permitir cambiar el usuario propietario de la etiqueta, ni alterar las tareas a las que la etiqueta esté asociada.

#### Scenario: Renombrado correcto
- **WHEN** un usuario autenticado cambia el nombre de una etiqueta suya por otro nombre válido que no usa en ninguna otra de sus etiquetas
- **THEN** el sistema responde con estado `200`, devuelve la etiqueta con el nuevo nombre, y ese nombre es el que aparece en consultas posteriores

#### Scenario: Renombrado de una etiqueta ya asociada a tareas
- **WHEN** se renombra una etiqueta que está asociada a una o más tareas
- **THEN** las asociaciones se conservan intactas y esas tareas pasan a presentar la etiqueta con su nuevo nombre

#### Scenario: Renombrado al nombre de otra etiqueta propia
- **WHEN** un usuario intenta renombrar una etiqueta suya con el nombre de otra etiqueta que ya tiene, ignorando mayúsculas y minúsculas
- **THEN** el sistema responde con estado `409` y ninguna de las dos etiquetas cambia

#### Scenario: Renombrado que solo cambia mayúsculas y minúsculas
- **WHEN** un usuario cambia el nombre de una etiqueta suya por el mismo nombre escrito con otras mayúsculas
- **THEN** el sistema responde con estado `200`, no lo trata como nombre duplicado, y las consultas posteriores devuelven la nueva grafía

#### Scenario: Renombrado a su propio nombre actual
- **WHEN** un usuario envía como nuevo nombre el que la etiqueta ya tiene
- **THEN** la operación tiene éxito y responde con estado `200`; no se trata como un conflicto de nombre duplicado

#### Scenario: Nombre inválido
- **WHEN** la petición de edición no incluye nombre, lo envía vacío o excede la longitud máxima admitida
- **THEN** el sistema responde con estado `400` y la etiqueta no se modifica

### Requirement: Eliminación de una etiqueta
El sistema MUST permitir eliminar una etiqueta propia mediante `DELETE /api/etiquetas/:id`. La eliminación MUST ser incondicional: el sistema MUST NOT exigir que la etiqueta no esté asociada a ninguna tarea.

#### Scenario: Eliminación correcta
- **WHEN** un usuario autenticado elimina una etiqueta suya
- **THEN** el sistema responde con estado `204` sin cuerpo, y la etiqueta deja de aparecer en su listado

#### Scenario: Eliminación repetida
- **WHEN** se intenta eliminar de nuevo una etiqueta ya eliminada
- **THEN** el sistema responde con estado `404`

### Requirement: Eliminar una etiqueta desasocia sus tareas pero no las elimina
Cuando se elimina una etiqueta que está asociada a una o más tareas, el sistema MUST eliminar únicamente esas asociaciones. Las tareas afectadas MUST seguir existiendo con el resto de sus datos sin cambios, incluidas las demás etiquetas que tuvieran.

#### Scenario: Baja de una etiqueta en uso
- **WHEN** se elimina una etiqueta asociada a dos tareas
- **THEN** ambas tareas siguen existiendo y ninguna de ellas presenta ya esa etiqueta

#### Scenario: Las demás etiquetas de la tarea se conservan
- **WHEN** se elimina una etiqueta de una tarea que llevaba además otras etiquetas
- **THEN** la tarea conserva todas sus otras etiquetas y solo pierde la eliminada

### Requirement: Una etiqueta ajena se comporta como inexistente
Cuando un usuario intenta editar o eliminar una etiqueta que no le pertenece, el sistema MUST responder con estado `404` y MUST NOT responder `403` ni ningún otro estado que permita distinguir una etiqueta ajena de un identificador que no existe. La operación MUST NOT modificar dato alguno.

#### Scenario: Edición de una etiqueta de otro usuario
- **WHEN** un usuario intenta renombrar una etiqueta cuyo dueño es otro usuario
- **THEN** el sistema responde con estado `404` y la etiqueta del otro usuario permanece intacta

#### Scenario: Eliminación de una etiqueta de otro usuario
- **WHEN** un usuario intenta eliminar una etiqueta cuyo dueño es otro usuario
- **THEN** el sistema responde con estado `404`, la etiqueta del otro usuario sigue existiendo y sus asociaciones a tareas permanecen intactas

#### Scenario: Indistinguibilidad respecto a un identificador inexistente
- **WHEN** un usuario opera sobre el identificador de una etiqueta ajena y sobre un identificador que no existe en el sistema
- **THEN** ambas respuestas son equivalentes en estado y en código de error, y ninguna revela que la etiqueta ajena existe

### Requirement: Errores consistentes en los endpoints de etiquetas
Toda respuesta de error de los endpoints de etiquetas MUST seguir el formato de error de la API, con un código de error estable independiente del texto y un mensaje en español, y MUST NOT exponer trazas de pila, mensajes del driver de base de datos ni nombres de tablas, columnas o restricciones.

#### Scenario: Conflicto de nombre duplicado
- **WHEN** el sistema rechaza una creación o una edición por nombre ya usado
- **THEN** la respuesta incluye el código estable propio de esa causa y un mensaje en español que no menciona ninguna restricción ni tabla de la base de datos

#### Scenario: Cuerpo de la petición ilegible
- **WHEN** una petición de creación o de edición envía un cuerpo que no es JSON válido
- **THEN** el sistema responde con estado `400` y el código estable de datos inválidos, y nunca con un error interno

#### Scenario: Campos desconocidos en el cuerpo
- **WHEN** una petición de creación o de edición incluye, además del nombre, campos que el endpoint no reconoce
- **THEN** el sistema los ignora, no responde error por su presencia, y la etiqueta queda con los datos que el endpoint sí reconoce

#### Scenario: Identificador de etiqueta mal formado
- **WHEN** se envía en la ruta un identificador que no tiene la forma de un identificador de etiqueta
- **THEN** el sistema responde con un error de datos inválidos o de recurso no encontrado, sin filtrar ningún detalle interno del almacenamiento
