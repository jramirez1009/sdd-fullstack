## Purpose

Define qué constancia deja la API de cada petición que atiende —para poder diagnosticar un fallo o auditar el uso sin depender de reproducirlo—, qué datos no debe registrar nunca por ser credenciales o datos personales, y cómo se ajustan el formato y el nivel del registro según el entorno de ejecución.

## Requirements

### Requirement: Registro de toda petición atendida
El sistema MUST registrar una entrada por cada petición HTTP que recibe la API, con independencia del endpoint invocado, de si la petición estaba autenticada y de si terminó en éxito o en error. Cada entrada MUST incluir, como mínimo, el método HTTP, la ruta solicitada, el código de estado de la respuesta y el tiempo transcurrido hasta completarla.

#### Scenario: Petición atendida con éxito
- **WHEN** una petición a cualquier endpoint se completa correctamente
- **THEN** queda registrada una entrada con su método HTTP, su ruta, el código de estado devuelto y el tiempo de respuesta

#### Scenario: Petición que termina en error
- **WHEN** una petición termina con un error de cliente o de servidor
- **THEN** queda registrada igualmente, con el código de estado del error, para que el registro refleje también lo que falla

#### Scenario: Petición rechazada por exceder un límite
- **WHEN** una petición se rechaza con estado `429` por superar un límite de peticiones
- **THEN** queda registrada con ese código de estado, porque el registro MUST abarcar también las peticiones que no llegan a ejecutar la lógica del endpoint

#### Scenario: Petición a una ruta inexistente
- **WHEN** se pide una ruta que la API no expone
- **THEN** queda registrada con el código de estado `404`

#### Scenario: Momento del registro
- **WHEN** una petición está siendo atendida y su respuesta aún no ha terminado
- **THEN** el sistema todavía no ha escrito su entrada, porque la entrada se escribe una sola vez al terminar la respuesta, que es cuando se conocen su código de estado y su tiempo

### Requirement: El registro no contiene credenciales
El registro MUST NOT contener nunca la contraseña de un usuario, ni en texto plano ni de ninguna otra forma derivada de ella, ni el JWT completo, aunque viajen en el cuerpo o en las cabeceras de la petición. El sistema MUST NOT volcar el cuerpo de la petición al registro.

#### Scenario: Inicio de sesión o registro de cuenta
- **WHEN** se atiende una petición a `POST /api/auth/login` o a `POST /api/auth/registro`, cuyo cuerpo contiene una contraseña
- **THEN** la entrada registrada no contiene la contraseña ni ningún fragmento de ella, ni el cuerpo de la petición

#### Scenario: Petición autenticada con JWT
- **WHEN** se atiende una petición que presenta un JWT en la cabecera `Authorization`
- **THEN** la entrada registrada puede dejar constancia de que la petición venía autenticada, pero MUST NOT contener el token, ni completo ni recortado a un fragmento que permita reconstruirlo o reutilizarlo

#### Scenario: Petición con cuerpo inesperado
- **WHEN** se atiende una petición cuyo cuerpo contiene campos que la API no espera
- **THEN** esos campos tampoco aparecen en el registro, porque el cuerpo no se vuelca nunca

### Requirement: Identificación del usuario en el registro
Cuando la petición ha sido autenticada, la entrada registrada MUST incluir el identificador del usuario que la realizó, para poder seguir el rastro de una sesión concreta. La entrada MUST NOT incluir el email del usuario ni ningún otro dato personal suyo.

#### Scenario: Petición autenticada
- **WHEN** una petición a un endpoint protegido se atiende con un JWT válido
- **THEN** la entrada registrada incluye el identificador del usuario del token y no incluye su email

#### Scenario: Petición sin autenticar
- **WHEN** una petición se atiende sin token, o con un token que no supera la validación
- **THEN** la entrada registrada indica que no hay usuario asociado, y se registra igualmente

### Requirement: Contexto de la petición en el registro
La entrada registrada MUST incluir el instante en que se atendió la petición y la dirección IP de origen, además de la cadena de consulta cuando la petición la lleve, de modo que el registro permita reconstruir qué se pidió exactamente.

#### Scenario: Petición con filtros
- **WHEN** se atiende una petición a `GET /api/tareas` con parámetros de consulta
- **THEN** la entrada registrada conserva la cadena de consulta junto a la ruta

#### Scenario: Datos de contexto siempre presentes
- **WHEN** se registra cualquier petición
- **THEN** su entrada incluye el instante en que se atendió y la dirección IP desde la que llegó

### Requirement: Formato y nivel del registro configurables por entorno
El formato de las entradas MUST poder elegirse por variable de entorno entre un formato legible por una persona y un formato estructurado con una entrada por línea, apto para ser consultado por herramientas. El nivel del registro MUST poder configurarse por entorno, e incluir un valor que lo silencie por completo. Ambos MUST tener un valor por defecto que permita arrancar sin configurarlos, y un valor no reconocido MUST impedir el arranque del servidor en lugar de aplicar en silencio otro comportamiento.

#### Scenario: Formato legible
- **WHEN** el entorno selecciona el formato legible
- **THEN** cada petición produce una línea pensada para leerse en una terminal

#### Scenario: Formato estructurado
- **WHEN** el entorno selecciona el formato estructurado
- **THEN** cada petición produce una única línea con todos los campos de la entrada en forma consultable por herramientas

#### Scenario: Registro silenciado
- **WHEN** el entorno selecciona el nivel que silencia el registro
- **THEN** las peticiones se atienden con normalidad y no se escribe ninguna entrada, de modo que la salida de una batería de tests no quede sepultada bajo el registro

#### Scenario: Configuración no reconocida
- **WHEN** el entorno define un formato o un nivel que el sistema no reconoce
- **THEN** el servidor no arranca e informa de qué variable es inválida y qué valores admite

### Requirement: Destino del registro
El sistema MUST escribir el registro de peticiones en la salida estándar del proceso y MUST NOT gestionar ficheros de registro propios ni su rotación. El registro de peticiones MUST NOT sustituir ni suprimir el volcado de los errores no controlados que la API ya realiza.

#### Scenario: Registro emitido por el proceso
- **WHEN** la API atiende peticiones
- **THEN** sus entradas salen por la salida estándar del proceso, y el sistema no crea ni rota ningún fichero de registro

#### Scenario: Error no controlado
- **WHEN** una petición termina por un error no previsto
- **THEN** el detalle técnico del error sigue volcándose como hasta ahora, además de la entrada de registro correspondiente a esa petición
