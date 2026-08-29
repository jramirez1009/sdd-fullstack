## Purpose

Define cómo una persona autenticada gestiona sus propias categorías a través de la API —crearlas, consultarlas, renombrarlas y eliminarlas— y qué garantías de propiedad, unicidad y aislamiento rigen sobre ellas, de modo que una tarea pueda después asignarse a una categoría que existe y es suya.

## ADDED Requirements

### Requirement: Toda operación sobre categorías exige autenticación
Todos los endpoints de categorías MUST ser endpoints protegidos: exigen un JWT válido en la cabecera `Authorization` con el esquema `Bearer`. El sistema MUST determinar el usuario propietario exclusivamente a partir de ese token y MUST NOT aceptar ningún identificador de usuario enviado por el cliente en la ruta, en la query ni en el cuerpo de la petición.

#### Scenario: Petición sin autenticación válida
- **WHEN** se llama a cualquier endpoint de categorías sin token, o con un token inválido, manipulado o expirado
- **THEN** el sistema responde con estado `401` y no crea, modifica, elimina ni devuelve ninguna categoría

#### Scenario: Intento de suplantar al propietario
- **WHEN** una petición autenticada incluye además un identificador de usuario propio en el cuerpo o en la query
- **THEN** el sistema lo ignora por completo y atribuye la operación al usuario del token

### Requirement: Creación de una categoría
El sistema MUST permitir crear una categoría mediante `POST /api/categorias` aportando su nombre. La categoría creada MUST pertenecer al usuario del token. La respuesta de éxito MUST devolver la categoría creada con su identificador.

#### Scenario: Creación correcta
- **WHEN** un usuario autenticado envía un nombre válido que aún no usa en ninguna de sus categorías
- **THEN** el sistema responde con estado `201`, devuelve la categoría creada con su identificador, su nombre y su fecha de creación, y la categoría queda asociada a ese usuario

#### Scenario: Nombre ausente, vacío o fuera de la longitud admitida
- **WHEN** la petición no incluye nombre, lo envía vacío o solo con espacios, o excede la longitud máxima admitida
- **THEN** el sistema responde con estado `400` indicando qué campo es inválido, y no crea ninguna categoría

### Requirement: Forma de la representación de una categoría
Una categoría MUST representarse siempre con los mismos campos —su identificador, su nombre y su fecha de creación— tanto al crearla como al editarla o al listarla. El identificador MUST viajar como cadena de texto, porque es un entero de 64 bits cuyo valor puede exceder la precisión de un número en JSON. Las operaciones sobre una categoría concreta MUST devolver el objeto directamente, sin envoltorio, y el listado MUST devolver un array directamente.

#### Scenario: Los mismos campos en creación, edición y listado
- **WHEN** un usuario crea una categoría, la renombra y después consulta su listado
- **THEN** la categoría aparece en las tres respuestas con el mismo conjunto de campos, y su identificador y su fecha de creación son los mismos en todas ellas

#### Scenario: El identificador no pierde precisión
- **WHEN** el cliente recibe el identificador de una categoría y lo usa tal cual en la ruta de una edición o de un borrado
- **THEN** la operación alcanza exactamente esa categoría, sin que ningún identificador se confunda con otro por redondeo

### Requirement: El nombre de una categoría es único dentro de cada usuario
Un usuario MUST NOT poder tener dos categorías con el mismo nombre, ignorando las diferencias de mayúsculas y minúsculas. Dos usuarios distintos MUST poder tener cada uno una categoría con el mismo nombre sin conflicto entre ellos.

#### Scenario: Nombre ya usado por el mismo usuario
- **WHEN** un usuario que ya tiene una categoría "Trabajo" intenta crear otra llamada "trabajo"
- **THEN** el sistema responde con estado `409` con un código de error estable, no crea la categoría, y la existente permanece intacta

#### Scenario: Mismo nombre en usuarios distintos
- **WHEN** dos usuarios distintos crean cada uno una categoría "Trabajo"
- **THEN** ambas creaciones tienen éxito y cada categoría pertenece únicamente a su dueño

### Requirement: Normalización y caracteres admitidos en el nombre
El sistema MUST recortar los espacios de los extremos del nombre antes de validarlo y guardarlo, y MUST conservar tal cual los espacios interiores. El nombre MUST normalizarse a la forma Unicode NFC antes de guardarse, de modo que dos nombres que se ven idénticos no puedan coexistir como categorías distintas. El sistema MUST rechazar un nombre que contenga saltos de línea o caracteres de control, y MUST admitir cualquier otro carácter, incluidos acentos, alfabetos no latinos y emojis. La longitud máxima MUST contarse en caracteres tal como los percibe la persona, de forma coherente con el límite que impone el almacenamiento.

#### Scenario: Espacios alrededor del nombre
- **WHEN** un usuario crea una categoría cuyo nombre lleva espacios al principio o al final
- **THEN** la categoría se guarda con el nombre ya recortado, y ese nombre recortado es el que devuelven las consultas posteriores

#### Scenario: Nombres equivalentes tras la normalización
- **WHEN** un usuario que ya tiene una categoría con un nombre acentuado intenta crear otra cuyo nombre se ve exactamente igual pero está escrito con una composición Unicode distinta
- **THEN** el sistema responde con estado `409`, porque para una persona son el mismo nombre

#### Scenario: Nombre con un salto de línea o un carácter de control
- **WHEN** la petición envía un nombre que contiene un salto de línea o un carácter de control
- **THEN** el sistema responde con estado `400` y no crea ni modifica ninguna categoría

#### Scenario: Nombre con emojis o alfabetos no latinos
- **WHEN** un usuario crea una categoría cuyo nombre contiene emojis o caracteres de un alfabeto no latino, dentro de la longitud admitida
- **THEN** la creación tiene éxito y el nombre se conserva exactamente como se envió

### Requirement: Listado de las categorías propias
El sistema MUST exponer `GET /api/categorias`, que devuelve todas las categorías del usuario del token y solo ellas, ordenadas por nombre. La respuesta MUST NOT incluir ninguna categoría de otro usuario.

#### Scenario: Usuario con categorías
- **WHEN** un usuario autenticado consulta sus categorías
- **THEN** el sistema responde con estado `200` y devuelve la lista de sus categorías ordenada por nombre, cada una con su identificador, su nombre y su fecha de creación

#### Scenario: Usuario sin categorías
- **WHEN** un usuario que no ha creado ninguna categoría consulta el listado
- **THEN** el sistema responde con estado `200` y una lista vacía, no un error

#### Scenario: Aislamiento entre usuarios
- **WHEN** dos usuarios que tienen categorías consultan el listado con sus respectivos tokens
- **THEN** cada uno recibe únicamente sus propias categorías, y ninguna categoría aparece en la respuesta de quien no es su dueño

### Requirement: Edición del nombre de una categoría
El sistema MUST permitir renombrar una categoría propia mediante `PUT /api/categorias/:id`. La respuesta de éxito MUST devolver la categoría con su nombre ya modificado. La edición MUST NOT permitir cambiar el usuario propietario de la categoría.

#### Scenario: Renombrado correcto
- **WHEN** un usuario autenticado cambia el nombre de una categoría suya por otro nombre válido que no usa en ninguna otra de sus categorías
- **THEN** el sistema responde con estado `200`, devuelve la categoría con el nuevo nombre, y ese nombre es el que aparece en consultas posteriores

#### Scenario: Renombrado al nombre de otra categoría propia
- **WHEN** un usuario intenta renombrar una categoría suya con el nombre de otra categoría que ya tiene, ignorando mayúsculas y minúsculas
- **THEN** el sistema responde con estado `409` y ninguna de las dos categorías cambia

#### Scenario: Renombrado que solo cambia mayúsculas y minúsculas
- **WHEN** un usuario cambia el nombre de una categoría suya por el mismo nombre escrito con otras mayúsculas
- **THEN** el sistema responde con estado `200`, no lo trata como nombre duplicado, y las consultas posteriores devuelven la nueva grafía

#### Scenario: Renombrado a su propio nombre actual
- **WHEN** un usuario envía como nuevo nombre el que la categoría ya tiene
- **THEN** la operación tiene éxito y responde con estado `200`; no se trata como un conflicto de nombre duplicado

#### Scenario: Nombre inválido
- **WHEN** la petición de edición no incluye nombre, lo envía vacío o excede la longitud máxima admitida
- **THEN** el sistema responde con estado `400` y la categoría no se modifica

### Requirement: Eliminación de una categoría
El sistema MUST permitir eliminar una categoría propia mediante `DELETE /api/categorias/:id`. La eliminación MUST ser incondicional: el sistema MUST NOT exigir que la categoría no tenga tareas asignadas.

#### Scenario: Eliminación correcta
- **WHEN** un usuario autenticado elimina una categoría suya
- **THEN** el sistema responde con estado `204` sin cuerpo, y la categoría deja de aparecer en su listado

#### Scenario: Eliminación de una categoría con tareas asignadas
- **WHEN** se elimina una categoría que tiene tareas asignadas
- **THEN** esas tareas siguen existiendo con el resto de sus datos sin cambios y quedan sin categoría

#### Scenario: Eliminación repetida
- **WHEN** se intenta eliminar de nuevo una categoría ya eliminada
- **THEN** el sistema responde con estado `404`

### Requirement: Una categoría ajena se comporta como inexistente
Cuando un usuario intenta editar o eliminar una categoría que no le pertenece, el sistema MUST responder con estado `404` y MUST NOT responder `403` ni ningún otro estado que permita distinguir una categoría ajena de un identificador que no existe. La operación MUST NOT modificar dato alguno.

#### Scenario: Edición de una categoría de otro usuario
- **WHEN** un usuario intenta renombrar una categoría cuyo dueño es otro usuario
- **THEN** el sistema responde con estado `404` y la categoría del otro usuario permanece intacta

#### Scenario: Eliminación de una categoría de otro usuario
- **WHEN** un usuario intenta eliminar una categoría cuyo dueño es otro usuario
- **THEN** el sistema responde con estado `404` y la categoría del otro usuario sigue existiendo

#### Scenario: Indistinguibilidad respecto a un identificador inexistente
- **WHEN** un usuario opera sobre el identificador de una categoría ajena y sobre un identificador que no existe en el sistema
- **THEN** ambas respuestas son equivalentes en estado y en código de error, y ninguna revela que la categoría ajena existe

### Requirement: Errores consistentes en los endpoints de categorías
Toda respuesta de error de los endpoints de categorías MUST seguir el formato de error de la API, con un código de error estable independiente del texto y un mensaje en español, y MUST NOT exponer trazas de pila, mensajes del driver de base de datos ni nombres de tablas, columnas o restricciones.

#### Scenario: Conflicto de nombre duplicado
- **WHEN** el sistema rechaza una creación o una edición por nombre ya usado
- **THEN** la respuesta incluye el código estable propio de esa causa y un mensaje en español que no menciona ninguna restricción ni tabla de la base de datos

#### Scenario: Cuerpo de la petición ilegible
- **WHEN** una petición de creación o de edición envía un cuerpo que no es JSON válido
- **THEN** el sistema responde con estado `400` y el código estable de datos inválidos, y nunca con un error interno

#### Scenario: Campos desconocidos en el cuerpo
- **WHEN** una petición de creación o de edición incluye, además del nombre, campos que el endpoint no reconoce
- **THEN** el sistema los ignora, no responde error por su presencia, y la categoría queda con los datos que el endpoint sí reconoce

#### Scenario: Identificador de categoría mal formado
- **WHEN** se envía en la ruta un identificador que no tiene la forma de un identificador de categoría
- **THEN** el sistema responde con un error de datos inválidos o de recurso no encontrado, sin filtrar ningún detalle interno del almacenamiento
