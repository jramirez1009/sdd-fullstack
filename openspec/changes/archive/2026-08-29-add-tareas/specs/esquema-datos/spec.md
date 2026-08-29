## ADDED Requirements

### Requirement: Búsqueda por texto indexada sobre el contenido de una tarea
El esquema MUST soportar la búsqueda por texto libre en el título y en la descripción de las tareas de un usuario apoyándose en un índice, sin recorrer secuencialmente sus tareas ni las de nadie más. La correspondencia entre el texto buscado y el contenido de la tarea MUST ignorar las diferencias de mayúsculas y minúsculas y las de acentuación, y MUST reconocer variantes flexivas de una misma palabra en español. El contenido indexado MUST mantenerse siempre en correspondencia con el título y la descripción vigentes de la tarea, sin que ninguna consulta de escritura tenga que acordarse de actualizarlo.

Este requisito lo motiva el parámetro `busqueda` de `GET /api/tareas`, que el reto exige y que ha de resolverse sin degradar su tiempo de respuesta a medida que crece el número de tareas.

#### Scenario: Búsqueda de una palabra del título o de la descripción
- **WHEN** se buscan las tareas de un usuario por una palabra que aparece en el título de unas y en la descripción de otras
- **THEN** se recuperan todas ellas y ninguna tarea de otro usuario

#### Scenario: Diferencias de caja, de acentos y de flexión
- **WHEN** el texto buscado difiere del texto almacenado en mayúsculas, en acentos o en la forma flexiva de la palabra
- **THEN** la tarea se recupera igualmente, por tratarse de la misma palabra

#### Scenario: El contenido indexado sigue al de la tarea
- **WHEN** se modifica el título o la descripción de una tarea existente
- **THEN** las búsquedas posteriores encuentran la tarea por su nuevo contenido y dejan de encontrarla por el anterior, sin ninguna acción adicional

#### Scenario: La búsqueda se resuelve con índice
- **WHEN** se ejecuta la búsqueda sobre un conjunto grande de tareas
- **THEN** la consulta se resuelve apoyándose en un índice y no requiere recorrer todas las filas de la tabla
