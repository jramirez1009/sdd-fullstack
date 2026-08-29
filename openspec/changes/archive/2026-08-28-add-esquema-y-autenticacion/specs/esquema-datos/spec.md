## Purpose

Define la estructura relacional persistente del dominio de la aplicación: qué entidades existen (usuarios, categorías, etiquetas, tareas y su vínculo muchos a muchos), cómo se relacionan y qué reglas de integridad garantizan que ningún dato quede huérfano ni sin dueño.

## ADDED Requirements

### Requirement: Entidades del dominio persistidas
El sistema MUST persistir cinco entidades relacionadas: `usuarios`, `categorias`, `etiquetas`, `tareas` y el vínculo `tarea_etiquetas`. Cada entidad MUST tener un identificador propio, estable y único dentro de su tipo.

#### Scenario: Identificador único por entidad
- **WHEN** se crean dos registros de la misma entidad
- **THEN** cada uno recibe un identificador distinto que lo referencia de forma inequívoca

#### Scenario: Referencia a un identificador inexistente
- **WHEN** se intenta crear un registro que apunta a un identificador que no existe en la entidad referenciada
- **THEN** la operación MUST ser rechazada y no persistir ningún dato

### Requirement: Unicidad del email de usuario
El email de un usuario MUST ser único en todo el sistema, y la comparación entre emails MUST ignorar las diferencias de mayúsculas y minúsculas. No pueden coexistir dos usuarios cuyos emails solo difieran en la caja de sus letras.

#### Scenario: Alta con email ya registrado
- **WHEN** se intenta persistir un usuario cuyo email ya pertenece a otro usuario
- **THEN** la operación MUST ser rechazada y el usuario existente MUST permanecer intacto

#### Scenario: Alta con el mismo email en otra caja
- **WHEN** existe un usuario con email `ana@ejemplo.com` y se intenta persistir otro con `Ana@Ejemplo.com`
- **THEN** la operación MUST ser rechazada por tratarse del mismo email

### Requirement: La contraseña se persiste únicamente como hash
El sistema MUST almacenar la contraseña de un usuario exclusivamente en forma de hash criptográfico con sal. La contraseña en texto plano MUST NOT persistirse en ninguna tabla, columna, registro de auditoría ni traza de la aplicación.

#### Scenario: Inspección directa del almacenamiento
- **WHEN** se consulta directamente el registro de un usuario recién creado
- **THEN** el valor almacenado para la contraseña es un hash del que no se puede recuperar la contraseña original

### Requirement: Cada dato de negocio pertenece a un único usuario
Toda categoría, etiqueta y tarea MUST estar asociada de forma obligatoria a exactamente un usuario propietario. No puede existir una categoría, una etiqueta ni una tarea sin usuario propietario.

#### Scenario: Creación sin propietario
- **WHEN** se intenta persistir una categoría, etiqueta o tarea sin usuario propietario
- **THEN** la operación MUST ser rechazada

### Requirement: Eliminar un usuario elimina en cascada todo lo suyo
Cuando se elimina un usuario, el sistema MUST eliminar también sus categorías, sus etiquetas, sus tareas y los vínculos entre sus tareas y sus etiquetas. MUST NOT quedar ningún dato de negocio referenciando a un usuario inexistente.

#### Scenario: Baja de un usuario con datos asociados
- **WHEN** se elimina un usuario que tiene categorías, etiquetas y tareas
- **THEN** todos esos registros y sus vínculos dejan de existir, y los datos de los demás usuarios permanecen intactos

### Requirement: Nombres de categoría y etiqueta únicos por usuario
Dentro de los datos de un mismo usuario, el nombre de una categoría MUST ser único, y el de una etiqueta también, ignorando las diferencias de mayúsculas y minúsculas. Usuarios distintos MUST poder usar los mismos nombres sin interferir entre sí.

#### Scenario: Nombre repetido en el mismo usuario
- **WHEN** un usuario que ya tiene una categoría "Trabajo" intenta crear otra llamada "trabajo"
- **THEN** la operación MUST ser rechazada por tratarse del mismo nombre

#### Scenario: Mismo nombre en usuarios distintos
- **WHEN** dos usuarios distintos crean cada uno una categoría "Trabajo"
- **THEN** ambas se persisten y cada una pertenece únicamente a su dueño

### Requirement: Contenido y estado de una tarea
Una tarea MUST tener un título no vacío. Su descripción, su fecha de vencimiento y su categoría son opcionales. Toda tarea MUST tener en todo momento un estado y una prioridad pertenecientes a conjuntos cerrados de valores; una tarea creada sin indicarlos MUST recibir el estado inicial y la prioridad intermedia por defecto.

#### Scenario: Tarea sin título
- **WHEN** se intenta persistir una tarea sin título o con un título vacío
- **THEN** la operación MUST ser rechazada

#### Scenario: Estado o prioridad fuera del conjunto admitido
- **WHEN** se intenta persistir una tarea con un estado o una prioridad que no pertenece a su conjunto de valores admitidos
- **THEN** la operación MUST ser rechazada

#### Scenario: Tarea creada sin estado ni prioridad
- **WHEN** se persiste una tarea sin indicar estado ni prioridad
- **THEN** la tarea queda con el estado inicial y con la prioridad intermedia

### Requirement: Registro temporal del ciclo de vida de una tarea
El sistema MUST registrar, para cada tarea, el instante de su creación, el de su última modificación y el de su finalización. El instante de finalización MUST estar vacío mientras la tarea no esté completada.

#### Scenario: Tarea aún no completada
- **WHEN** se consulta una tarea que no ha sido completada
- **THEN** consta su instante de creación y su instante de última modificación, y su instante de finalización está vacío

#### Scenario: Tarea completada
- **WHEN** una tarea pasa a estado completada
- **THEN** queda registrado el instante en que ocurrió, de modo que pueda medirse después el tiempo transcurrido desde su creación

### Requirement: La fecha de vencimiento designa un día, no un instante
La fecha de vencimiento de una tarea MUST expresar un día del calendario sin hora asociada, de modo que la condición de vencida no dependa de la zona horaria desde la que se consulte.

#### Scenario: Consulta desde zonas horarias distintas
- **WHEN** se consulta la misma tarea desde dos zonas horarias diferentes dentro del mismo día natural
- **THEN** su fecha de vencimiento es la misma en ambos casos

### Requirement: Una tarea pertenece a una categoría o a ninguna
Una tarea MUST estar asociada como máximo a una categoría. La categoría de una tarea es opcional: una tarea sin categoría es un estado válido.

#### Scenario: Tarea creada sin categoría
- **WHEN** se persiste una tarea sin indicar categoría
- **THEN** la tarea se almacena correctamente y su categoría queda vacía

### Requirement: Eliminar una categoría no elimina sus tareas
Cuando se elimina una categoría, sus tareas MUST conservarse y quedar sin categoría. La eliminación de una categoría MUST NOT provocar la pérdida de ninguna tarea.

#### Scenario: Baja de una categoría con tareas asignadas
- **WHEN** se elimina una categoría que tiene tareas asignadas
- **THEN** esas tareas siguen existiendo con el resto de sus datos sin cambios, y su categoría queda vacía

### Requirement: Relación muchos a muchos entre tareas y etiquetas
Una tarea MUST poder tener cero o varias etiquetas, y una etiqueta MUST poder estar asociada a varias tareas. El sistema MUST NOT permitir que la misma etiqueta se asocie dos veces a la misma tarea.

#### Scenario: Etiqueta reutilizada en varias tareas
- **WHEN** se asocia la misma etiqueta a dos tareas distintas
- **THEN** ambas asociaciones se persisten y ambas tareas presentan esa etiqueta

#### Scenario: Asociación duplicada
- **WHEN** se intenta asociar una etiqueta a una tarea a la que ya está asociada
- **THEN** la operación MUST NOT producir una segunda asociación

#### Scenario: Baja de una tarea o de una etiqueta
- **WHEN** se elimina una tarea o una etiqueta
- **THEN** los vínculos que la involucran dejan de existir, y ni las etiquetas ni las tareas del otro lado del vínculo se eliminan por ello

### Requirement: Consultas eficientes sobre los criterios de uso habitual
El esquema MUST soportar de forma eficiente la recuperación de las tareas de un usuario filtradas por estado, categoría, prioridad y fecha de vencimiento, sin degradar su tiempo de respuesta de forma proporcional al total de tareas de todos los usuarios.

#### Scenario: Filtrado de tareas del usuario
- **WHEN** se recuperan las tareas de un usuario aplicando cualquier combinación de esos criterios
- **THEN** la consulta se resuelve apoyándose en índices y no requiere recorrer las tareas de otros usuarios
