## Purpose

Define cuántas peticiones admite la API desde un mismo origen y en qué ventana de tiempo, qué respuesta obtiene quien supera ese límite, y qué límite reforzado protege el inicio de sesión frente a ataques de fuerza bruta contra contraseñas.

## Requirements

### Requirement: Límite general de peticiones por origen
La API MUST limitar el número de peticiones que atiende desde una misma dirección IP dentro de una ventana de tiempo. El límite MUST aplicarse a todos los endpoints de la API, estén protegidos por autenticación o no, y MUST evaluarse antes de que la petición alcance la lógica de cualquier endpoint. El sistema MUST NOT exigir configuración explícita para que el límite esté activo: sin configuración, rige un límite por defecto.

#### Scenario: Peticiones dentro del límite
- **WHEN** una dirección IP realiza menos peticiones de las permitidas dentro de la ventana vigente
- **THEN** cada petición se atiende con normalidad y su respuesta es idéntica a la que devolvería la API sin límite alguno

#### Scenario: Se supera el límite general
- **WHEN** una dirección IP supera el número de peticiones permitidas dentro de la ventana vigente
- **THEN** el sistema responde con estado `429`, no ejecuta la lógica del endpoint solicitado y no consulta la base de datos

#### Scenario: La ventana expira
- **WHEN** una dirección IP bloqueada por haber superado el límite vuelve a pedir una vez terminada la ventana
- **THEN** su cuenta de peticiones vuelve a empezar y la petición se atiende con normalidad

#### Scenario: Dos orígenes distintos no se afectan entre sí
- **WHEN** una dirección IP agota su cuota y otra dirección IP distinta realiza una petición
- **THEN** la segunda se atiende con normalidad, porque cada dirección IP tiene su propia cuenta

#### Scenario: Comprobación previa de CORS
- **WHEN** un navegador envía la petición `OPTIONS` de comprobación previa que precede a una llamada desde otro origen
- **THEN** se responde a la comprobación sin consumir cuota, porque el límite cuenta las peticiones de la aplicación y no las que el navegador añade por su cuenta

#### Scenario: El límite alcanza también a las rutas inexistentes
- **WHEN** una dirección IP supera el límite pidiendo repetidamente una ruta que la API no expone
- **THEN** el sistema responde `429` en lugar de `404`, porque el límite se evalúa antes de resolver la ruta

### Requirement: Respuesta al superar un límite
Cuando se rechaza una petición por superar un límite, el sistema MUST responder con estado `429` y con el mismo formato de error que el resto de la API, empleando un código de error estable propio de esta situación, distinto de cualquier otro código ya existente. El sistema MUST NOT cerrar la conexión sin respuesta ni dejar que la petición expire. El mensaje MUST NOT revelar cuál de los límites se ha superado ni el estado de los contadores.

#### Scenario: Forma de la respuesta de rechazo
- **WHEN** una petición se rechaza por superar un límite
- **THEN** la respuesta tiene estado `429`, su cuerpo sigue el formato de error de la API y su código de error identifica de forma estable el exceso de peticiones, de modo que un cliente pueda distinguirlo de cualquier otro error sin leer el texto del mensaje

#### Scenario: El mensaje no distingue qué límite se superó
- **WHEN** se rechaza una petición por el límite general y se rechaza otra por el límite de inicio de sesión
- **THEN** el mensaje devuelto es el mismo en ambos casos y MUST NOT indicar que el bloqueo procede del inicio de sesión

### Requirement: Información del límite en las respuestas
Las respuestas de los endpoints cubiertos por un límite MUST informar del límite aplicado, de cuántas peticiones quedan disponibles y de cuándo se reinicia la ventana. La respuesta de rechazo MUST indicar además cuánto tiempo debe esperar el cliente antes de reintentar.

#### Scenario: Petición atendida bajo un límite
- **WHEN** se atiende una petición cubierta por un límite
- **THEN** la respuesta informa del máximo de peticiones de la ventana, de cuántas quedan y del instante en que la ventana se reinicia

#### Scenario: Petición rechazada por exceso
- **WHEN** se rechaza una petición con estado `429`
- **THEN** la respuesta indica además cuánto tiempo debe esperar el cliente antes de reintentar, de modo que no tenga que reintentar a ciegas

### Requirement: Límite reforzado del inicio de sesión
El endpoint `POST /api/auth/login` MUST estar sujeto, además del límite general, a un límite propio y más estricto que cuente únicamente los intentos de inicio de sesión realizados desde una misma dirección IP. Ambos límites MUST evaluarse de forma independiente, y una petición MUST ser rechazada en cuanto supere cualquiera de los dos.

#### Scenario: Ráfaga de intentos de inicio de sesión
- **WHEN** una dirección IP realiza más intentos de inicio de sesión de los que permite el límite reforzado dentro de su ventana, aunque no haya agotado el límite general
- **THEN** el sistema responde `429` y no comprueba las credenciales enviadas

#### Scenario: El bloqueo del inicio de sesión no bloquea el resto de la API
- **WHEN** una dirección IP agota el límite reforzado del inicio de sesión pero no el general
- **THEN** puede seguir usando con normalidad los demás endpoints de la API, incluido `POST /api/auth/registro`

#### Scenario: Un intento correcto también consume cuota
- **WHEN** un intento de inicio de sesión se realiza con credenciales correctas
- **THEN** consume igualmente una unidad del límite reforzado, porque el contador MUST NOT depender del resultado de la autenticación

#### Scenario: El límite reforzado no cubre el registro de cuentas
- **WHEN** se realizan peticiones a `POST /api/auth/registro`
- **THEN** solo les aplica el límite general, y no el límite reforzado del inicio de sesión

### Requirement: Configuración de los límites por entorno
El número máximo de peticiones y la duración de la ventana MUST ser configurables por variable de entorno, de forma independiente para el límite general y para el límite reforzado del inicio de sesión, sin necesidad de modificar código. Cada valor MUST tener un valor por defecto que permita arrancar la aplicación sin configurarlos. Si un valor configurado no es un número entero positivo, el servidor MUST NOT arrancar y MUST explicar qué variable es inválida.

#### Scenario: Arranque sin configurar los límites
- **WHEN** el entorno no define ninguna variable de límite
- **THEN** la aplicación arranca y los límites quedan activos con sus valores por defecto

#### Scenario: Límite ajustado por entorno
- **WHEN** el entorno define un máximo de peticiones o una ventana distintos de los valores por defecto
- **THEN** el límite aplicado es el configurado, sin ningún cambio en el código

#### Scenario: Valor de configuración inválido
- **WHEN** una variable de límite contiene un valor que no es un número entero positivo
- **THEN** el servidor no arranca e informa de qué variable es inválida, en lugar de ignorarla y aplicar un límite distinto del pedido

### Requirement: Determinación del origen de la petición
El sistema MUST identificar el origen de una petición por su dirección IP. Que la dirección se tome de la conexión directa o de las cabeceras que añade un proxy inverso MUST ser configurable por entorno, y el valor por defecto MUST ser no confiar en dichas cabeceras.

#### Scenario: Despliegue sin proxy inverso
- **WHEN** la API recibe peticiones directamente y no se ha configurado confianza en el proxy
- **THEN** el origen es la dirección de la conexión, y una cabecera de reenvío enviada por el cliente MUST NOT alterar a qué contador se imputa la petición

#### Scenario: Despliegue tras un proxy inverso
- **WHEN** la API se despliega tras un proxy inverso y el entorno declara que debe confiarse en él
- **THEN** el origen es la dirección del cliente que el proxy reporta, de modo que el límite no agrupe a todos los clientes bajo la dirección del proxy
