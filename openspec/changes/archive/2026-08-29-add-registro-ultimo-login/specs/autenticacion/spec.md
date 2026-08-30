## MODIFIED Requirements

### Requirement: Inicio de sesión con emisión de JWT
El sistema MUST permitir iniciar sesión mediante `POST /api/auth/login` aportando email y contraseña. Ante credenciales correctas, el sistema MUST emitir un JWT firmado que identifique al usuario y tenga una fecha de expiración, y MUST devolver junto a él los datos públicos del usuario. El endpoint MUST NOT requerir autenticación previa.

Todo inicio de sesión exitoso MUST tener como efecto adicional registrar el instante actual como último inicio de sesión del usuario. Un intento de inicio de sesión que el sistema rechaza por credenciales incorrectas MUST NOT modificar ese instante. El registro del último inicio de sesión MUST NOT alterar el cuerpo de la respuesta de este endpoint y MUST NOT hacer fracasar el inicio de sesión si esa escritura no puede completarse.

#### Scenario: Credenciales correctas
- **WHEN** se envían un email registrado y su contraseña correcta
- **THEN** el sistema responde con estado `200` y devuelve un JWT firmado asociado a ese usuario junto con su identificador, su email y su nombre

#### Scenario: El inicio de sesión exitoso registra el instante
- **WHEN** un usuario inicia sesión con éxito
- **THEN** su último inicio de sesión pasa a ser el instante de esa petición, con independencia de cuál fuera su valor anterior

#### Scenario: Email con mayúsculas distintas a las del registro
- **WHEN** se envía el email de un usuario registrado escrito con otras mayúsculas y su contraseña correcta
- **THEN** el inicio de sesión tiene éxito, porque el email identifica a la misma cuenta

#### Scenario: Credenciales incorrectas
- **WHEN** el email no está registrado, o la contraseña no corresponde al email enviado
- **THEN** el sistema responde con estado `401` y un mensaje genérico idéntico en ambos casos, que MUST NOT revelar si el email existe en el sistema

#### Scenario: Un intento fallido no toca el último inicio de sesión
- **WHEN** se envía un email registrado con una contraseña incorrecta
- **THEN** el sistema responde con estado `401` y el último inicio de sesión del usuario conserva el valor que tuviera antes del intento

#### Scenario: Datos de entrada inválidos
- **WHEN** falta el email o la contraseña en la petición
- **THEN** el sistema responde con estado `400` y no consulta credenciales

### Requirement: Consulta del perfil del usuario autenticado
El sistema MUST exponer `GET /api/auth/perfil`, un endpoint protegido que devuelve los datos del usuario identificado por el token presentado. La respuesta MAY incluir el instante del último inicio de sesión del usuario; si lo incluye, MUST reflejar un valor vacío cuando el usuario nunca ha iniciado sesión. Ese dato MUST referirse siempre al propio usuario autenticado y MUST NOT exponerse en ninguna respuesta que agregue o liste datos de otros usuarios.

#### Scenario: Perfil con token válido
- **WHEN** un usuario autenticado consulta su perfil
- **THEN** el sistema responde con estado `200` y devuelve los datos públicos de ese usuario: su identificador, su email, su nombre y su fecha de alta

#### Scenario: Aislamiento entre usuarios
- **WHEN** dos usuarios distintos consultan el perfil con sus respectivos tokens
- **THEN** cada uno recibe únicamente sus propios datos, y el token de un usuario MUST NOT permitir obtener los datos de otro

#### Scenario: El último inicio de sesión, si se muestra, es el del propio usuario
- **WHEN** la respuesta del perfil incluye el instante del último inicio de sesión
- **THEN** ese instante corresponde al usuario que presenta el token y está vacío si ese usuario nunca ha iniciado sesión con éxito

#### Scenario: Perfil sin autenticación válida
- **WHEN** se consulta el perfil sin token, o con un token inválido o expirado
- **THEN** el sistema responde con estado `401` y no devuelve dato alguno de usuario
