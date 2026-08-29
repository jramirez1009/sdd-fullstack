## Purpose

Define cómo una persona se registra, inicia sesión y cierra sesión desde la interfaz web, cómo la aplicación recuerda que está autenticada mientras navega y entre recargas, y qué garantiza sobre que toda llamada a la API protegida viaje autenticada y reaccione a la pérdida de validez del JWT.

## Requirements

### Requirement: Registro desde la interfaz
La aplicación MUST ofrecer una pantalla de registro con campos de email y contraseña. Antes de llamar a la API, la aplicación MUST comprobar que ambos campos tienen contenido, que el email tiene formato de dirección de correo y que la contraseña está dentro de la longitud que la API admite. Estas comprobaciones son únicamente para dar respuesta inmediata a la persona: la autoridad sobre la validez de los datos sigue siendo la API, y la aplicación MUST mostrar el error que la API devuelva aunque sus propias comprobaciones hayan pasado.

#### Scenario: Registro correcto
- **WHEN** una persona envía un email no registrado y una contraseña válida
- **THEN** la aplicación crea la cuenta, deja a esa persona con la sesión iniciada sin pedirle que vuelva a escribir sus credenciales, y la lleva a la pantalla principal de tareas

#### Scenario: Campo vacío
- **WHEN** se intenta enviar el formulario de registro con el email o la contraseña vacíos
- **THEN** la aplicación señala el campo que falta, no realiza ninguna llamada a la API y la persona permanece en la pantalla de registro

#### Scenario: Email con formato inválido
- **WHEN** se intenta enviar el formulario de registro con un email que no tiene formato de dirección de correo
- **THEN** la aplicación señala el email como inválido y no realiza ninguna llamada a la API

#### Scenario: Contraseña fuera de la longitud admitida
- **WHEN** se intenta enviar el formulario de registro con una contraseña más corta o más larga de lo que la API admite
- **THEN** la aplicación señala la contraseña como inválida, indica cuál es la longitud admitida y no realiza ninguna llamada a la API

#### Scenario: Email ya registrado
- **WHEN** la API rechaza el registro porque ya existe una cuenta con ese email
- **THEN** la aplicación muestra ese motivo de forma visible, conserva lo que la persona había escrito y le permite corregirlo sin volver a rellenar el formulario entero

#### Scenario: Rechazo de la API pese a la validación del cliente
- **WHEN** la API rechaza el registro por un motivo que la aplicación no comprueba en el cliente
- **THEN** la aplicación muestra el mensaje que la API devuelve y no da la cuenta por creada

### Requirement: Inicio de sesión desde la interfaz
La aplicación MUST ofrecer una pantalla de inicio de sesión con campos de email y contraseña. Ante credenciales incorrectas, el mensaje mostrado MUST ser el mismo tanto si el email no está registrado como si la contraseña no corresponde, y MUST NOT permitir deducir cuál de las dos cosas falló.

#### Scenario: Credenciales correctas
- **WHEN** una persona envía un email registrado y su contraseña correcta
- **THEN** la aplicación establece la sesión y la lleva a la pantalla principal de tareas

#### Scenario: Credenciales incorrectas
- **WHEN** la API rechaza el inicio de sesión por credenciales inválidas
- **THEN** la aplicación muestra un único mensaje de error, idéntico para un email inexistente y para una contraseña equivocada, la persona permanece en la pantalla de inicio de sesión y no se establece ninguna sesión

#### Scenario: Campo vacío
- **WHEN** se intenta enviar el formulario de inicio de sesión con el email o la contraseña vacíos
- **THEN** la aplicación señala el campo que falta y no realiza ninguna llamada a la API

#### Scenario: La API no está disponible
- **WHEN** la llamada de inicio de sesión falla por un error de red o porque la API no responde
- **THEN** la aplicación muestra un mensaje que distingue ese fallo de unas credenciales incorrectas, y permite reintentar sin recargar la página

### Requirement: La sesión vive en un único estado compartido
La aplicación MUST mantener el estado de autenticación —el JWT y los datos públicos del usuario— en un único lugar accesible a toda la interfaz, y MUST exponerlo a los componentes por una vía única. Ningún componente MUST leer ni escribir el JWT por otro camino.

#### Scenario: Un componente consulta la sesión
- **WHEN** cualquier parte de la interfaz necesita saber si hay sesión o quién es el usuario autenticado
- **THEN** obtiene esa información del estado compartido, y no de la lectura directa del almacenamiento del navegador ni de un dato duplicado en otro sitio

#### Scenario: La sesión cambia
- **WHEN** se inicia sesión, se cierra sesión o se restaura una sesión guardada
- **THEN** toda la interfaz que dependa del estado de autenticación refleja el cambio, sin necesidad de recargar la página

### Requirement: Toda llamada a la API protegida viaja autenticada
Mientras exista una sesión, la aplicación MUST adjuntar el JWT a toda petición a un endpoint protegido de la API, sin que el componente que origina la llamada tenga que ocuparse de ello. Las llamadas de registro e inicio de sesión, que no requieren autenticación, MUST NOT depender de que exista sesión.

#### Scenario: Petición con sesión activa
- **WHEN** una parte autenticada de la interfaz solicita datos a la API
- **THEN** la petición incluye el JWT de la sesión activa en la cabecera de autorización

#### Scenario: Petición sin sesión a un endpoint público
- **WHEN** se llama al registro o al inicio de sesión sin sesión previa
- **THEN** la petición se realiza igualmente y no se ve afectada por la ausencia de token

#### Scenario: El token cambia entre dos peticiones
- **WHEN** una persona cierra sesión e inicia sesión con otra cuenta
- **THEN** las peticiones posteriores viajan con el token de la nueva sesión y ninguna reutiliza el anterior

### Requirement: La sesión sobrevive a una recarga de la página
La aplicación MUST guardar el JWT en el almacenamiento persistente del navegador al establecer una sesión, y al arrancar MUST intentar restaurar la sesión a partir de él. La aplicación MUST NOT dar por válido un token guardado sin comprobar antes contra la API que sigue siéndolo. Mientras esa comprobación está en curso, la aplicación MUST NOT tratar a la persona como no autenticada ni llevarla a la pantalla de inicio de sesión.

#### Scenario: Recarga con token válido
- **WHEN** una persona con sesión iniciada recarga la página
- **THEN** la aplicación restaura su sesión y la deja donde estaba, sin pedirle credenciales de nuevo

#### Scenario: Recarga con token ya expirado o revocado
- **WHEN** al arrancar existe un token guardado que la API ya no acepta
- **THEN** la aplicación descarta el token guardado, no establece sesión y lleva a la persona a la pantalla de inicio de sesión

#### Scenario: Arranque sin token guardado
- **WHEN** se abre la aplicación en un navegador donde no hay ningún token guardado
- **THEN** la aplicación no realiza ninguna comprobación de sesión y muestra directamente la pantalla de inicio de sesión

#### Scenario: Comprobación de sesión en curso
- **WHEN** la aplicación está arrancando y todavía no sabe si el token guardado es válido
- **THEN** muestra un estado de carga explícito, y no decide todavía qué pantalla corresponde

### Requirement: La expiración de la sesión se resuelve cerrándola, no rompiendo la pantalla
Si la API responde que la petición no está autenticada en cualquier llamada distinta del registro y del inicio de sesión, la aplicación MUST descartar el token guardado, vaciar el estado de sesión y llevar a la persona a la pantalla de inicio de sesión. La aplicación MUST NOT dejar visible una pantalla protegida con datos vacíos, incompletos o desactualizados tras ese rechazo.

#### Scenario: El token expira mientras se usa la aplicación
- **WHEN** una petición a un endpoint protegido es rechazada por falta de autenticación válida
- **THEN** la aplicación cierra la sesión localmente, borra el token guardado y lleva a la persona a la pantalla de inicio de sesión con una indicación de que su sesión ha caducado

#### Scenario: El rechazo del inicio de sesión no se confunde con una expiración
- **WHEN** el rechazo por falta de autenticación proviene de la propia llamada de inicio de sesión con credenciales incorrectas
- **THEN** la aplicación lo trata como un error del formulario y no como una sesión caducada, y la persona permanece en la pantalla de inicio de sesión sin ningún mensaje de caducidad

### Requirement: Cierre de sesión
La aplicación MUST ofrecer una acción de cierre de sesión desde cualquier pantalla protegida. Al ejecutarla, MUST vaciar el estado de autenticación, descartar el token guardado en el navegador y llevar a la persona a la pantalla de inicio de sesión.

#### Scenario: Cierre de sesión explícito
- **WHEN** una persona autenticada ejecuta la acción de cerrar sesión
- **THEN** la aplicación deja de considerarla autenticada, borra el token guardado y muestra la pantalla de inicio de sesión

#### Scenario: Recarga después de cerrar sesión
- **WHEN** se recarga la página después de haber cerrado sesión
- **THEN** la aplicación no restaura ninguna sesión y muestra la pantalla de inicio de sesión

### Requirement: Las pantallas protegidas exigen sesión
La aplicación MUST impedir que se muestre una pantalla protegida sin una sesión establecida, con independencia de cómo se haya llegado a ella. Una persona ya autenticada que solicite la pantalla de inicio de sesión o la de registro MUST ser llevada a la pantalla principal de tareas.

#### Scenario: Acceso directo a una pantalla protegida sin sesión
- **WHEN** se solicita la dirección de una pantalla protegida sin sesión establecida
- **THEN** la aplicación no muestra su contenido y lleva a la persona a la pantalla de inicio de sesión

#### Scenario: Acceso a las pantallas de autenticación con sesión activa
- **WHEN** una persona con sesión activa solicita la pantalla de inicio de sesión o la de registro
- **THEN** la aplicación la lleva a la pantalla principal de tareas

#### Scenario: Dirección desconocida
- **WHEN** se solicita una dirección que la aplicación no reconoce
- **THEN** la aplicación lleva a la persona a la pantalla principal de tareas si tiene sesión, y a la de inicio de sesión si no la tiene

### Requirement: Cada espera y cada fallo tienen representación visible
Mientras una llamada de registro o de inicio de sesión está en curso, la aplicación MUST mostrar un estado de carga y MUST deshabilitar el control de envío correspondiente, de modo que un segundo envío no pueda lanzarse antes de que el primero termine. Todo fallo, sea de validación, de credenciales o de red, MUST tener una representación visible; la aplicación MUST NOT quedar en silencio ante un error.

#### Scenario: Petición en curso
- **WHEN** se ha enviado el formulario de inicio de sesión o de registro y la respuesta aún no ha llegado
- **THEN** la aplicación muestra un estado de carga y el control de envío queda deshabilitado

#### Scenario: Doble envío
- **WHEN** se acciona repetidamente el control de envío mientras la petición está en curso
- **THEN** solo se realiza una petición

#### Scenario: Reintento tras un fallo
- **WHEN** una petición termina con error
- **THEN** el estado de carga desaparece, el control de envío vuelve a estar habilitado y el mensaje de error queda visible hasta el siguiente intento

### Requirement: La interfaz no expone material sensible
La aplicación MUST NOT mostrar el JWT ni la contraseña en la interfaz, ni escribirlos en los registros del navegador. El campo de contraseña MUST ocultar lo que se escribe en él.

#### Scenario: Introducción de la contraseña
- **WHEN** una persona escribe su contraseña en el formulario de registro o de inicio de sesión
- **THEN** el campo la muestra oculta

#### Scenario: Contenido de los registros del navegador
- **WHEN** se inspecciona la consola del navegador tras un registro, un inicio de sesión o un fallo de cualquiera de ellos
- **THEN** no aparece ni el JWT ni ninguna contraseña
