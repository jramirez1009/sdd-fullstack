## Purpose

Define cómo una persona obtiene una cuenta en el sistema, cómo demuestra su identidad ante la API mediante un JWT y qué significa que un endpoint esté protegido, estableciendo el mecanismo de identidad del que dependen todas las funcionalidades posteriores.

## Requirements

### Requirement: Registro de usuario
El sistema MUST permitir registrar un usuario nuevo mediante `POST /api/auth/registro` aportando email y contraseña, y opcionalmente un nombre para mostrar. El endpoint MUST NOT requerir autenticación ni exigir el nombre. La respuesta de éxito MUST devolver los datos públicos del usuario creado.

#### Scenario: Registro correcto
- **WHEN** se envía un email no registrado y una contraseña válida
- **THEN** el sistema crea el usuario, responde con estado `201` y devuelve el identificador, el email y el nombre del usuario creado

#### Scenario: Registro sin nombre
- **WHEN** se envía un registro válido que no incluye nombre
- **THEN** el sistema crea el usuario igualmente y su nombre queda vacío

#### Scenario: Email ya registrado
- **WHEN** se envía un email que ya pertenece a otro usuario, con independencia de las mayúsculas y minúsculas empleadas
- **THEN** el sistema responde con estado `409`, no crea ningún usuario y el mensaje de error MUST NOT revelar detalles internos del almacenamiento

#### Scenario: Contraseña fuera de la longitud admitida
- **WHEN** la contraseña mide menos de 8 bytes o más de 72
- **THEN** el sistema responde con estado `400` y no crea el usuario; el sistema MUST NOT truncar la contraseña ni aceptarla de forma parcial

#### Scenario: Datos de entrada inválidos
- **WHEN** falta el email o la contraseña, o el email no tiene formato válido
- **THEN** el sistema responde con estado `400` indicando qué campos son inválidos, y no modifica la base de datos

### Requirement: Inicio de sesión con emisión de JWT
El sistema MUST permitir iniciar sesión mediante `POST /api/auth/login` aportando email y contraseña. Ante credenciales correctas, el sistema MUST emitir un JWT firmado que identifique al usuario y tenga una fecha de expiración, y MUST devolver junto a él los datos públicos del usuario. El endpoint MUST NOT requerir autenticación previa.

#### Scenario: Credenciales correctas
- **WHEN** se envían un email registrado y su contraseña correcta
- **THEN** el sistema responde con estado `200` y devuelve un JWT firmado asociado a ese usuario junto con su identificador, su email y su nombre

#### Scenario: Email con mayúsculas distintas a las del registro
- **WHEN** se envía el email de un usuario registrado escrito con otras mayúsculas y su contraseña correcta
- **THEN** el inicio de sesión tiene éxito, porque el email identifica a la misma cuenta

#### Scenario: Credenciales incorrectas
- **WHEN** el email no está registrado, o la contraseña no corresponde al email enviado
- **THEN** el sistema responde con estado `401` y un mensaje genérico idéntico en ambos casos, que MUST NOT revelar si el email existe en el sistema

#### Scenario: Datos de entrada inválidos
- **WHEN** falta el email o la contraseña en la petición
- **THEN** el sistema responde con estado `400` y no consulta credenciales

### Requirement: El JWT es el único portador de identidad aceptado
La API MUST identificar al usuario en todo endpoint protegido exclusivamente a partir de un JWT válido presentado en la cabecera `Authorization` con el esquema `Bearer`. El sistema MUST NOT mantener sesiones de servidor ni aceptar ningún otro mecanismo de identificación.

#### Scenario: Petición sin token
- **WHEN** se llama a un endpoint protegido sin cabecera `Authorization`
- **THEN** el sistema responde con estado `401` y no ejecuta la lógica del endpoint

#### Scenario: Token inválido, manipulado o mal formado
- **WHEN** se presenta un token cuya firma no es válida, cuyo contenido ha sido alterado, o que no sigue el esquema `Bearer <token>`
- **THEN** el sistema responde con estado `401` y no ejecuta la lógica del endpoint

#### Scenario: Token expirado
- **WHEN** se presenta un token cuya fecha de expiración ya ha pasado
- **THEN** el sistema responde con estado `401` y no ejecuta la lógica del endpoint

#### Scenario: Token válido
- **WHEN** se presenta un token firmado por el sistema, no expirado y correspondiente a un usuario existente
- **THEN** la petición procede y el endpoint atribuye la operación a ese usuario y solo a ese usuario

### Requirement: Consulta del perfil del usuario autenticado
El sistema MUST exponer `GET /api/auth/perfil`, un endpoint protegido que devuelve los datos del usuario identificado por el token presentado.

#### Scenario: Perfil con token válido
- **WHEN** un usuario autenticado consulta su perfil
- **THEN** el sistema responde con estado `200` y devuelve los datos públicos de ese usuario: su identificador, su email, su nombre y su fecha de alta

#### Scenario: Aislamiento entre usuarios
- **WHEN** dos usuarios distintos consultan el perfil con sus respectivos tokens
- **THEN** cada uno recibe únicamente sus propios datos, y el token de un usuario MUST NOT permitir obtener los datos de otro

#### Scenario: Perfil sin autenticación válida
- **WHEN** se consulta el perfil sin token, o con un token inválido o expirado
- **THEN** el sistema responde con estado `401` y no devuelve dato alguno de usuario

### Requirement: El hash de contraseña nunca sale de la API
Ninguna respuesta de la API MUST incluir el hash de la contraseña de un usuario, ni en respuestas de éxito, ni en respuestas de error, ni en ningún campo anidado, bajo ninguna circunstancia.

#### Scenario: Respuestas de los endpoints de autenticación
- **WHEN** se inspecciona el cuerpo de la respuesta de registro, de login o de perfil
- **THEN** no aparece el hash de la contraseña ni ningún otro material derivado de ella

### Requirement: Los errores no filtran detalles internos
Las respuestas de error de la API MUST seguir un formato consistente y MUST NOT exponer trazas de pila, mensajes del driver de base de datos, nombres de tablas o columnas, ni ningún otro detalle de implementación interna.

#### Scenario: Fallo inesperado durante una petición
- **WHEN** se produce un error no previsto al atender una petición de autenticación
- **THEN** el sistema responde con estado `500` y un mensaje genérico, y el detalle técnico queda únicamente en los registros del servidor

### Requirement: Los errores se identifican por un código estable
Toda respuesta de error MUST incluir un código de error estable, independiente del texto del mensaje, que identifique la causa. El mensaje dirigido a la persona usuaria MUST estar redactado en español. Un cambio en la redacción de un mensaje MUST NOT alterar el código correspondiente.

#### Scenario: Consumo del error por el cliente
- **WHEN** la API rechaza una petición por email duplicado, credenciales inválidas, falta de autenticación o datos inválidos
- **THEN** la respuesta incluye el código estable propio de esa causa junto a un mensaje en español, de modo que el cliente pueda decidir su comportamiento sin interpretar el texto
