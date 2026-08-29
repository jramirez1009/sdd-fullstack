## Purpose

Define cómo una persona autenticada gestiona sus categorías desde la interfaz web —consultarlas, crear una nueva, renombrarla y eliminarla— dentro del armazón de la aplicación, qué valida el cliente antes de llamar a la API, cómo presenta el conflicto de nombre duplicado y los estados de carga y error, y cómo mantiene la lista al día sin recargar la página.

## ADDED Requirements

### Requirement: La sección de categorías vive dentro del armazón
La aplicación MUST ofrecer una sección de categorías que se renderiza dentro de la estructura común de las pantallas autenticadas (cabecera, navegación lateral, área de contenido) que define `frontend-cascaron`. La navegación lateral MUST incluir un enlace a la sección de categorías y MUST marcarlo como activo cuando esa sección está a la vista. La sección MUST exigir sesión: una persona sin sesión válida MUST NOT poder verla.

#### Scenario: Acceso a categorías desde la navegación
- **WHEN** una persona autenticada elige "Categorías" en la navegación lateral
- **THEN** el área de contenido muestra la pantalla de categorías, la cabecera y la navegación permanecen en su sitio, y el enlace de categorías queda marcado como activo

#### Scenario: Acceso directo por la dirección de la sección
- **WHEN** una persona autenticada abre directamente la dirección de la sección de categorías
- **THEN** ve la pantalla de categorías dentro del armazón y la navegación marca esa sección como activa

#### Scenario: Persona sin sesión
- **WHEN** alguien sin sesión válida intenta abrir la sección de categorías
- **THEN** la aplicación no muestra la pantalla de categorías y lleva a la persona a iniciar sesión, según el comportamiento que ya define `frontend-autenticacion`

### Requirement: Listado de las categorías propias
La pantalla de categorías MUST mostrar todas las categorías del usuario autenticado, y solo las suyas, ordenadas por nombre, obtenidas mediante una llamada a la API a través de la capa de servicios; ningún componente hace la petición HTTP por su cuenta. Cada categoría de la lista MUST mostrar su nombre y ofrecer las acciones de editar y eliminar.

#### Scenario: Usuario con categorías
- **WHEN** una persona con categorías abre la sección
- **THEN** ve la lista de sus categorías ordenada por nombre, cada una con su nombre visible y con las acciones de editar y eliminar disponibles

#### Scenario: Usuario sin categorías
- **WHEN** una persona que no ha creado ninguna categoría abre la sección
- **THEN** ve un mensaje que indica que aún no tiene categorías y la acción para crear la primera, no un error ni una lista en blanco sin explicación

### Requirement: Estado de carga y de error al obtener las categorías
Mientras la lista de categorías se está cargando, la pantalla MUST mostrar el componente común de carga. Si la carga falla, la pantalla MUST mostrar el componente común de error de negocio con un mensaje comprensible y MUST ofrecer una acción de reintento que vuelve a solicitar la lista sin recargar la página.

#### Scenario: Carga en curso
- **WHEN** la pantalla de categorías está esperando la respuesta de la API con la lista
- **THEN** muestra el indicador común de carga y no muestra una lista vacía ni un error

#### Scenario: La carga de la lista falla
- **WHEN** la petición de la lista de categorías termina en error
- **THEN** la pantalla muestra el componente común de error con un mensaje comprensible y una acción de reintento

#### Scenario: Reintento tras un fallo de carga
- **WHEN** la persona usa la acción de reintento después de un fallo de carga
- **THEN** la aplicación vuelve a solicitar la lista y, si esta vez responde correctamente, muestra las categorías sin que la persona haya recargado la página

### Requirement: Un único formulario para crear y editar una categoría
La aplicación MUST usar un mismo formulario para crear una categoría nueva y para renombrar una existente. El formulario MUST determinar su modo según reciba o no una categoría existente: sin categoría crea una nueva; con una categoría existente parte de su nombre actual y la renombra. El formulario MUST tener un único campo editable, el nombre.

#### Scenario: Alta de una categoría nueva
- **WHEN** una persona abre el formulario sin una categoría existente, escribe un nombre válido y lo envía
- **THEN** la aplicación crea la categoría mediante la API y, al tener éxito, la nueva categoría aparece en la lista

#### Scenario: Renombrado de una categoría existente
- **WHEN** una persona abre el formulario para una categoría existente, cambia el nombre por otro válido y lo envía
- **THEN** la aplicación renombra esa categoría mediante la API y, al tener éxito, la lista muestra el nuevo nombre

### Requirement: Validación del nombre en el cliente antes de llamar a la API
Antes de enviar una creación o una edición, la aplicación MUST comprobar que el nombre no está vacío ni contiene solo espacios. Si la comprobación falla, la aplicación MUST señalar el campo de nombre como inválido y MUST NOT realizar ninguna llamada a la API. Esta comprobación es solo para dar respuesta inmediata: la autoridad sobre la validez sigue siendo la API, y la aplicación MUST mostrar el error que la API devuelva aunque su propia comprobación haya pasado.

#### Scenario: Nombre vacío
- **WHEN** una persona intenta enviar el formulario con el nombre vacío o con solo espacios
- **THEN** la aplicación señala el campo de nombre como inválido, no realiza ninguna llamada a la API y la persona permanece en el formulario

#### Scenario: Rechazo de la API pese a la validación del cliente
- **WHEN** el nombre pasa la comprobación del cliente pero la API lo rechaza como inválido
- **THEN** la aplicación muestra el motivo que la API devuelve y conserva lo que la persona había escrito

### Requirement: El conflicto de nombre duplicado se muestra junto al campo de nombre
Cuando la API rechaza una creación o una edición porque el usuario ya tiene otra categoría con ese nombre, la aplicación MUST mostrar ese motivo específico junto al campo de nombre del formulario, no como un error genérico de página, y MUST conservar lo que la persona había escrito para que pueda corregirlo sin volver a empezar. Los demás fallos previsibles (red no disponible, sesión caducada, error interno del servidor) MUST usar la presentación genérica de error de negocio.

#### Scenario: Nombre ya usado por el mismo usuario
- **WHEN** una persona envía un nombre que coincide, ignorando mayúsculas y minúsculas, con otra categoría que ya tiene
- **THEN** el formulario muestra el mensaje de nombre duplicado pegado al campo de nombre, mantiene el valor escrito y permite corregirlo, sin cerrar el formulario ni perder el resto del contexto

#### Scenario: Otro fallo durante el envío
- **WHEN** una creación o edición falla por un motivo distinto del nombre duplicado (por ejemplo, no hay conexión)
- **THEN** la aplicación muestra ese fallo con el componente común de error de negocio, no junto al campo de nombre

### Requirement: Eliminar una categoría exige confirmación y explica su efecto
Antes de eliminar una categoría, la aplicación MUST pedir una confirmación explícita a la persona. El texto de la confirmación MUST explicar brevemente que las tareas asociadas a esa categoría no se eliminan, solo quedan sin categoría. La eliminación MUST ejecutarse solo si la persona confirma; si la cancela, no se realiza ninguna llamada a la API y la categoría permanece.

#### Scenario: Confirmación de la eliminación
- **WHEN** una persona pide eliminar una categoría y confirma la acción
- **THEN** la aplicación elimina la categoría mediante la API y, al tener éxito, esa categoría deja de aparecer en la lista

#### Scenario: Cancelación de la eliminación
- **WHEN** una persona pide eliminar una categoría y cancela en la confirmación
- **THEN** no se realiza ninguna llamada a la API y la categoría sigue en la lista

#### Scenario: La confirmación informa del efecto sobre las tareas
- **WHEN** se muestra la confirmación de eliminación
- **THEN** su texto indica que las tareas de esa categoría no se borran y que quedarán sin categoría

### Requirement: Estado de acción en curso al crear, editar o eliminar
Mientras una acción de creación, edición o eliminación está en curso, la aplicación MUST mostrar el componente común de carga y MUST impedir que la misma acción se lance por duplicado. Si la acción falla, la aplicación MUST mostrar el fallo (junto al campo de nombre si es un conflicto de nombre duplicado, con el componente común de error en cualquier otro caso) y dejar a la persona en condiciones de reintentar.

#### Scenario: Acción en curso
- **WHEN** una persona ha enviado una creación, una edición o una eliminación y la respuesta aún no ha llegado
- **THEN** la aplicación muestra el indicador de carga y no permite reenviar la misma acción hasta que termine

#### Scenario: La acción falla
- **WHEN** una acción de creación, edición o eliminación termina en error
- **THEN** la aplicación muestra el motivo y la persona puede corregir y reintentar sin recargar la página

### Requirement: La lista se actualiza tras una acción exitosa sin recargar la página
Tras crear, editar o eliminar una categoría con éxito, la lista mostrada MUST reflejar el resultado de inmediato —la nueva categoría aparece, el nombre editado se actualiza, la categoría eliminada desaparece— sin que la persona tenga que recargar la página. El orden por nombre de la lista MUST mantenerse después de la actualización.

#### Scenario: Alta reflejada en la lista
- **WHEN** una creación termina con éxito
- **THEN** la nueva categoría aparece en la lista en su posición por orden de nombre, sin recargar la página

#### Scenario: Edición reflejada en la lista
- **WHEN** un renombrado termina con éxito
- **THEN** la lista muestra el nuevo nombre y lo recoloca según el orden por nombre, sin recargar la página

#### Scenario: Eliminación reflejada en la lista
- **WHEN** una eliminación termina con éxito
- **THEN** la categoría deja de aparecer en la lista de inmediato, sin recargar la página

### Requirement: El acceso a la API de categorías va encapsulado en un hook reutilizable
Toda comunicación de la pantalla de categorías con `/api/categorias` (listar, crear, editar, eliminar) MUST pasar por un hook personalizado dedicado que se apoya en la capa de servicios de la API; los componentes de lista y de formulario MUST NOT hacer `fetch` ni llamar a la capa de servicios directamente. Ese hook MUST quedar disponible para que otras pantallas —en particular la de tareas— lo reutilicen sin duplicar la lógica de acceso.

#### Scenario: Los componentes no hablan HTTP directamente
- **WHEN** se inspecciona el componente de lista o el de formulario de categorías
- **THEN** ninguno realiza llamadas HTTP ni invoca la capa de servicios por su cuenta; toda operación pasa por el hook dedicado

#### Scenario: Reutilización desde otra pantalla
- **WHEN** otra pantalla necesita la lista de categorías del usuario (por ejemplo, para un selector)
- **THEN** puede obtenerla a través del mismo hook, sin reimplementar las llamadas a `/api/categorias`

### Requirement: Toda llamada a la API de categorías viaja autenticada
Las llamadas a `/api/categorias` que hace la pantalla MUST viajar con el JWT de la sesión vigente y MUST reaccionar a la pérdida de validez del token según el comportamiento que ya define `frontend-autenticacion`: un `401` en una de estas llamadas cierra la sesión y lleva a la persona a iniciar sesión de nuevo.

#### Scenario: Llamada autenticada
- **WHEN** la pantalla de categorías realiza cualquier operación contra `/api/categorias`
- **THEN** la petición incluye el JWT de la sesión vigente sin que el componente tenga que adjuntarlo a mano

#### Scenario: Token caducado durante el uso
- **WHEN** una operación sobre categorías recibe un `401` porque el token ha dejado de valer
- **THEN** la aplicación cierra la sesión y lleva a la persona a iniciar sesión, sin mostrar la respuesta como un error corriente de la pantalla
