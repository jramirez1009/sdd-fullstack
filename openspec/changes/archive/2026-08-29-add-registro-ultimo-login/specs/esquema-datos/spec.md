## ADDED Requirements

### Requirement: Registro del último inicio de sesión del usuario
El sistema MUST registrar, para cada usuario, el instante de su último inicio de sesión exitoso. Ese instante MUST estar vacío mientras el usuario no haya iniciado sesión con éxito ninguna vez desde su registro; un valor vacío es un estado válido y MUST NOT sustituirse por la fecha de alta ni por ninguna otra fecha inventada. El instante MUST conservar la referencia de zona horaria, de modo que pueda compararse sin ambigüedad con un momento dado.

Este requisito lo motiva la pregunta de inteligencia de negocio sobre "usuarios activos en los últimos 7 días", que define la actividad de un usuario por la cercanía de su último inicio de sesión y que hasta ahora no disponía de ningún dato en el esquema para resolverse.

#### Scenario: Usuario recién registrado que nunca ha iniciado sesión
- **WHEN** se consulta directamente el registro de un usuario recién creado que aún no ha iniciado sesión
- **THEN** su instante de último inicio de sesión está vacío

#### Scenario: El instante refleja el último inicio de sesión exitoso
- **WHEN** un usuario inicia sesión con éxito y más tarde vuelve a hacerlo
- **THEN** su instante de último inicio de sesión pasa a ser el del inicio de sesión más reciente y no conserva el anterior

#### Scenario: Comparación con una ventana temporal
- **WHEN** se recuperan los usuarios cuyo último inicio de sesión cae dentro de los últimos 7 días
- **THEN** quedan incluidos los que iniciaron sesión en esa ventana y excluidos tanto los que lo hicieron antes como los que nunca han iniciado sesión
