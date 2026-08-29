## Purpose

Define cómo una persona autenticada gestiona sus tareas desde la interfaz web —consultarlas con filtros, búsqueda y ordenación; crear una tarea; editarla; eliminarla; y marcarla completada o no completada— dentro del armazón de la aplicación, qué valida el cliente antes de llamar a la API, cómo asigna categoría y etiquetas, cómo presenta los estados de carga y error, y cómo mantiene la lista al día sin recargar la página.

## ADDED Requirements

### Requirement: La sección de tareas vive dentro del armazón
La aplicación MUST ofrecer una sección de tareas que se renderiza dentro de la estructura común de las pantallas autenticadas (cabecera, navegación lateral, área de contenido) que define `frontend-cascaron`. La navegación lateral MUST incluir un enlace a la sección de tareas y MUST marcarlo como activo cuando esa sección está a la vista. La sección MUST exigir sesión: una persona sin sesión válida MUST NOT poder verla.

#### Scenario: Acceso a tareas desde la navegación
- **WHEN** una persona autenticada elige "Tareas" en la navegación lateral
- **THEN** el área de contenido muestra la pantalla de tareas, la cabecera y la navegación permanecen en su sitio, y el enlace de tareas queda marcado como activo

#### Scenario: Acceso directo por la dirección de la sección
- **WHEN** una persona autenticada abre directamente la dirección de la sección de tareas
- **THEN** ve la pantalla de tareas dentro del armazón y la navegación marca esa sección como activa

#### Scenario: Persona sin sesión
- **WHEN** alguien sin sesión válida intenta abrir la sección de tareas
- **THEN** la aplicación no muestra la pantalla de tareas y lleva a la persona a iniciar sesión, según el comportamiento que ya define `frontend-autenticacion`

### Requirement: Listado de las tareas propias
La pantalla de tareas MUST mostrar las tareas del usuario autenticado, y solo las suyas, obtenidas mediante una llamada a `GET /api/tareas` a través de la capa de servicios; ningún componente hace la petición HTTP por su cuenta. Sin filtros aplicados, el listado MUST mostrar todas las tareas del usuario en el orden por defecto que define el backend (fecha de creación descendente). Cada tarea de la lista MUST mostrar su título, su categoría si la tiene, su prioridad, su fecha de vencimiento si la tiene y sus etiquetas, y MUST ofrecer las acciones de editar, eliminar y cambiar su estado de completada.

#### Scenario: Usuario con tareas
- **WHEN** una persona con tareas abre la sección sin aplicar ningún filtro
- **THEN** ve la lista de sus tareas en orden de la más reciente a la más antigua, cada una con su título, su categoría (si tiene), su prioridad, su fecha de vencimiento (si tiene) y sus etiquetas visibles, y con las acciones de editar, eliminar y completar disponibles

#### Scenario: Usuario sin tareas
- **WHEN** una persona que no ha creado ninguna tarea abre la sección
- **THEN** ve un mensaje que indica que aún no tiene tareas y la acción para crear la primera, no un error ni una lista en blanco sin explicación

#### Scenario: Tarea sin categoría y sin etiquetas
- **WHEN** la lista incluye una tarea que no tiene categoría ni etiquetas
- **THEN** esa tarea se muestra sin adornos de categoría ni de etiquetas y sin ningún hueco que sugiera un dato ausente por error

### Requirement: Estado de carga y de error al obtener las tareas
Mientras la lista de tareas se está cargando —tanto la carga inicial como cualquier recarga provocada por un cambio de filtro—, la pantalla MUST mostrar el componente común de carga. Si la carga falla, la pantalla MUST mostrar el componente común de error de negocio con un mensaje comprensible y MUST ofrecer una acción de reintento que vuelve a solicitar la lista con los filtros vigentes sin recargar la página.

#### Scenario: Carga en curso
- **WHEN** la pantalla de tareas está esperando la respuesta de la API con la lista
- **THEN** muestra el indicador común de carga y no muestra una lista vacía ni un error

#### Scenario: La carga de la lista falla
- **WHEN** la petición de la lista de tareas termina en error
- **THEN** la pantalla muestra el componente común de error con un mensaje comprensible y una acción de reintento

#### Scenario: Reintento tras un fallo de carga
- **WHEN** la persona usa la acción de reintento después de un fallo de carga
- **THEN** la aplicación vuelve a solicitar la lista con los filtros que estuvieran aplicados y, si esta vez responde correctamente, muestra las tareas sin que la persona haya recargado la página

### Requirement: El acceso a la API de tareas va encapsulado en un hook reutilizable
Toda comunicación de la pantalla de tareas con `/api/tareas` y con `/api/tareas/:id/completar` (listar con filtros, crear, editar, eliminar, cambiar estado) MUST pasar por un hook personalizado dedicado que se apoya en la capa de servicios de la API; los componentes de lista, de fila, de filtro y de formulario MUST NOT hacer `fetch` ni llamar a la capa de servicios directamente. El hook MUST aceptar el conjunto de filtros activos y volver a consultar cuando ese conjunto cambia.

#### Scenario: Los componentes no hablan HTTP directamente
- **WHEN** se inspecciona cualquier componente de la pantalla de tareas
- **THEN** ninguno realiza llamadas HTTP ni invoca la capa de servicios por su cuenta; toda operación pasa por el hook dedicado

#### Scenario: El hook reacciona al cambio de filtros
- **WHEN** el conjunto de filtros activos que recibe el hook cambia
- **THEN** el hook solicita de nuevo `GET /api/tareas` con los parámetros correspondientes y expone el resultado actualizado

### Requirement: Toda llamada a la API de tareas y de etiquetas viaja autenticada
Las llamadas que hace la pantalla a `/api/tareas`, a `/api/tareas/:id/completar` y a `/api/etiquetas` MUST viajar con el JWT de la sesión vigente y MUST reaccionar a la pérdida de validez del token según el comportamiento que ya define `frontend-autenticacion`: un `401` en una de estas llamadas cierra la sesión y lleva a la persona a iniciar sesión de nuevo.

#### Scenario: Llamada autenticada
- **WHEN** la pantalla de tareas realiza cualquier operación contra la API
- **THEN** la petición incluye el JWT de la sesión vigente sin que el componente tenga que adjuntarlo a mano

#### Scenario: Token caducado durante el uso
- **WHEN** una operación sobre tareas recibe un `401` porque el token ha dejado de valer
- **THEN** la aplicación cierra la sesión y lleva a la persona a iniciar sesión, sin mostrar la respuesta como un error corriente de la pantalla

### Requirement: Un único formulario para crear y editar una tarea
La aplicación MUST usar un mismo formulario para crear una tarea nueva y para editar una existente. El formulario MUST determinar su modo según reciba o no una tarea existente: sin tarea crea una nueva; con una tarea existente parte de sus valores actuales y la edita. El formulario MUST tener el título como único campo obligatorio; la categoría, la descripción, la fecha de vencimiento, la prioridad y las etiquetas MUST ser opcionales.

#### Scenario: Alta de una tarea nueva solo con título
- **WHEN** una persona abre el formulario sin una tarea existente, escribe un título válido y lo envía sin rellenar ningún otro campo
- **THEN** la aplicación crea la tarea mediante la API y, al tener éxito, la nueva tarea aparece en la lista

#### Scenario: Alta de una tarea con todos los campos
- **WHEN** una persona abre el formulario, rellena título, descripción, categoría, fecha de vencimiento, prioridad y etiquetas y lo envía
- **THEN** la aplicación crea la tarea con todos esos datos y, al tener éxito, la tarea aparece en la lista con su categoría y sus etiquetas

#### Scenario: Edición de una tarea existente
- **WHEN** una persona abre el formulario para una tarea existente, cambia uno o varios campos y lo envía
- **THEN** el formulario aparece precargado con los valores actuales de la tarea, la aplicación la edita mediante la API y, al tener éxito, la lista muestra los datos actualizados

#### Scenario: El formulario de edición no cambia el estado de completada
- **WHEN** una persona edita una tarea desde el formulario
- **THEN** el formulario no ofrece cambiar si la tarea está completada; ese estado solo se cambia desde el control propio de cada tarea

### Requirement: Validación del título en el cliente antes de llamar a la API
Antes de enviar una creación o una edición, la aplicación MUST comprobar que el título no está vacío ni contiene solo espacios. Si la comprobación falla, la aplicación MUST señalar el campo de título como inválido y MUST NOT realizar ninguna llamada a la API. Esta comprobación es solo para dar respuesta inmediata: la autoridad sobre la validez sigue siendo la API, y la aplicación MUST mostrar el error que la API devuelva —junto al campo correspondiente cuando la respuesta lo identifica— aunque su propia comprobación haya pasado.

#### Scenario: Título vacío
- **WHEN** una persona intenta enviar el formulario con el título vacío o con solo espacios
- **THEN** la aplicación señala el campo de título como inválido, no realiza ninguna llamada a la API y la persona permanece en el formulario

#### Scenario: Rechazo de la API pese a la validación del cliente
- **WHEN** el título pasa la comprobación del cliente pero la API rechaza la creación o la edición por datos inválidos (por ejemplo, título demasiado largo, prioridad no admitida o fecha de vencimiento en el pasado)
- **THEN** la aplicación muestra el motivo que la API devuelve, lo asocia al campo que la respuesta identifica cuando lo hace, y conserva lo que la persona había escrito

### Requirement: El selector de categoría del formulario reutiliza el hook de categorías
El selector de categoría del formulario de tarea MUST obtener la lista de categorías del usuario a través del mismo hook personalizado que usa la pantalla de categorías (`frontend-categorias`); MUST NOT reimplementar la llamada a `/api/categorias`. El selector MUST permitir además dejar la tarea sin categoría.

#### Scenario: Categorías disponibles en el selector
- **WHEN** una persona abre el formulario de tarea
- **THEN** el selector de categoría ofrece las categorías del usuario obtenidas mediante el hook compartido de categorías, más la opción de no asignar ninguna

#### Scenario: Tarea sin categoría
- **WHEN** una persona crea o edita una tarea dejando el selector en la opción de sin categoría
- **THEN** la aplicación envía la tarea sin categoría y la lista la muestra sin categoría

### Requirement: Asignación de etiquetas con autocompletar y creación al vuelo
El formulario de tarea MUST ofrecer un campo de asignación de etiquetas que, al escribir, sugiere las etiquetas existentes del usuario obtenidas de `/api/etiquetas` a través de la capa de servicios. Si el texto escrito no coincide con ninguna etiqueta existente, el campo MUST ofrecer crear esa etiqueta al vuelo: al aceptarlo, la aplicación crea la etiqueta mediante `POST /api/etiquetas` y la añade de inmediato a la selección de la tarea que se está creando o editando. La lista de etiquetas seleccionadas MUST poder ampliarse y reducirse antes de guardar la tarea.

#### Scenario: Sugerencia de etiquetas existentes
- **WHEN** una persona empieza a escribir en el campo de etiquetas y tiene etiquetas cuyo nombre coincide con lo escrito
- **THEN** el campo muestra esas etiquetas como sugerencias y elegir una la añade a la selección de la tarea

#### Scenario: Creación de una etiqueta nueva al vuelo
- **WHEN** una persona escribe un nombre que no coincide con ninguna etiqueta suya y acepta la opción de crearla
- **THEN** la aplicación crea la etiqueta mediante `POST /api/etiquetas` y, al tener éxito, la etiqueta queda seleccionada en la tarea sin que la persona salga del formulario

#### Scenario: Quitar una etiqueta de la selección
- **WHEN** una persona quita una etiqueta ya seleccionada antes de guardar
- **THEN** la etiqueta deja de estar en la selección y la tarea se guardará sin ella

#### Scenario: Fallo al crear la etiqueta
- **WHEN** la creación de una etiqueta al vuelo termina en error
- **THEN** la aplicación muestra el motivo, no añade la etiqueta a la selección y deja a la persona continuar con el resto del formulario

### Requirement: Marcar una tarea como completada o no completada con estado explícito
Cada tarea de la lista MUST ofrecer un control para marcarla completada o no completada. El control MUST llamar a `PATCH /api/tareas/:id/completar` enviando el estado deseado de forma explícita, y MUST NOT enviar simplemente "lo contrario del estado actual". Mientras la llamada está en curso, la aplicación MUST impedir que la misma acción se lance por duplicado. Al tener éxito, la tarea MUST reflejar el nuevo estado de inmediato sin recargar la página.

#### Scenario: Marcar una tarea como completada
- **WHEN** una persona usa el control de completar sobre una tarea que no está completada
- **THEN** la aplicación envía el estado de completada en verdadero, y al tener éxito la tarea aparece como completada sin recargar la página

#### Scenario: Marcar una tarea como no completada
- **WHEN** una persona usa el control sobre una tarea que está completada
- **THEN** la aplicación envía el estado de completada en falso, y al tener éxito la tarea aparece como no completada sin recargar la página

#### Scenario: Doble activación del control
- **WHEN** una persona activa el control de completar dos veces seguidas antes de que llegue la respuesta
- **THEN** la aplicación realiza una sola llamada y no alterna el estado de forma inconsistente

#### Scenario: El cambio de estado falla
- **WHEN** la llamada para cambiar el estado de completada termina en error
- **THEN** la aplicación muestra el motivo con el componente común de error, la tarea conserva su estado anterior y la persona puede reintentar

### Requirement: Eliminar una tarea exige confirmación
Antes de eliminar una tarea, la aplicación MUST pedir una confirmación explícita a la persona mediante el diálogo de confirmación común. La eliminación MUST ejecutarse solo si la persona confirma; si la cancela, no se realiza ninguna llamada a la API y la tarea permanece. Al confirmar y tener éxito, la tarea MUST desaparecer de la lista de inmediato sin recargar la página.

#### Scenario: Confirmación de la eliminación
- **WHEN** una persona pide eliminar una tarea y confirma la acción
- **THEN** la aplicación elimina la tarea mediante la API y, al tener éxito, esa tarea deja de aparecer en la lista sin recargar la página

#### Scenario: Cancelación de la eliminación
- **WHEN** una persona pide eliminar una tarea y cancela en la confirmación
- **THEN** no se realiza ninguna llamada a la API y la tarea sigue en la lista

#### Scenario: El diálogo de confirmación es el componente común compartido
- **WHEN** se muestra la confirmación de eliminación de una tarea
- **THEN** se usa el mismo componente de confirmación de borrado que usa la pantalla de categorías, con el texto propio de tareas

### Requirement: Estado de acción en curso al crear, editar o eliminar una tarea
Mientras una acción de creación, edición o eliminación está en curso, la aplicación MUST mostrar el componente común de carga y MUST impedir que la misma acción se lance por duplicado. Si la acción falla, la aplicación MUST mostrar el fallo —junto al campo correspondiente cuando la respuesta de la API lo identifica, y con el componente común de error en cualquier otro caso— y dejar a la persona en condiciones de reintentar.

#### Scenario: Acción en curso
- **WHEN** una persona ha enviado una creación, una edición o una eliminación y la respuesta aún no ha llegado
- **THEN** la aplicación muestra el indicador de carga y no permite reenviar la misma acción hasta que termine

#### Scenario: La acción falla por un motivo de campo
- **WHEN** una creación o una edición falla porque la API señala un campo concreto como inválido (título, prioridad, fecha, categoría o etiquetas)
- **THEN** la aplicación muestra el motivo asociado a ese campo, conserva lo escrito y no cierra el formulario

#### Scenario: La acción falla por un motivo general
- **WHEN** una creación, edición o eliminación falla por un motivo no asociado a un campo (red no disponible, error interno del servidor)
- **THEN** la aplicación muestra ese fallo con el componente común de error de negocio y la persona puede reintentar sin recargar la página

### Requirement: La lista se actualiza tras una acción exitosa sin recargar la página
Tras crear, editar, eliminar o cambiar el estado de completada de una tarea con éxito, la lista mostrada MUST reflejar el resultado de inmediato —la nueva tarea aparece, la tarea editada muestra sus datos actualizados, la tarea eliminada desaparece, la tarea completada cambia su indicación de estado— sin que la persona tenga que recargar la página. La lista actualizada MUST seguir respetando los filtros, la búsqueda y la ordenación que estuvieran aplicados.

#### Scenario: Alta reflejada en la lista
- **WHEN** una creación termina con éxito
- **THEN** la lista se actualiza incorporando la nueva tarea según los filtros y el orden vigentes, sin recargar la página

#### Scenario: Edición reflejada en la lista
- **WHEN** una edición termina con éxito
- **THEN** la lista muestra los datos actualizados de la tarea y, si el cambio afecta a un filtro o al criterio de orden activo, recoloca o retira la tarea en consecuencia, sin recargar la página

#### Scenario: Eliminación reflejada en la lista
- **WHEN** una eliminación termina con éxito
- **THEN** la tarea deja de aparecer en la lista de inmediato, sin recargar la página

#### Scenario: Cambio de estado reflejado en la lista
- **WHEN** un cambio de estado de completada termina con éxito
- **THEN** la tarea muestra su nuevo estado de inmediato y, si hay un filtro por estado de completada activo que la tarea deja de cumplir, la tarea desaparece de la lista, sin recargar la página

### Requirement: Filtros del listado combinables y aplicados al instante
La pantalla MUST ofrecer filtros para el estado de completada, la categoría (incluida una opción reservada para las tareas sin categoría), la prioridad, un rango de fecha de vencimiento (extremo inicial, extremo final o ambos) y las etiquetas. Cualquier cambio en uno de estos filtros MUST disparar de inmediato una nueva consulta a `GET /api/tareas` con todos los filtros activos enviados juntos como parámetros de la misma petición, sin que exista un botón de "aplicar". Todos los filtros MUST ser combinables entre sí. Los filtros MUST aplicarse siempre dentro de las tareas del usuario, sin que ninguna combinación pueda mostrar una tarea ajena.

#### Scenario: Cambio de un filtro dispara la consulta
- **WHEN** una persona cambia el estado de completada, la categoría, la prioridad, un extremo del rango de fecha de vencimiento o las etiquetas del filtro
- **THEN** la aplicación consulta de inmediato `GET /api/tareas` con el conjunto completo de filtros activos y muestra el resultado, sin que la persona pulse ningún botón de aplicar

#### Scenario: Filtro por tareas sin categoría
- **WHEN** una persona elige en el filtro de categoría la opción reservada para las tareas sin categoría
- **THEN** la consulta envía el valor reservado que el backend define para ese caso y el resultado incluye solo tareas sin categoría

#### Scenario: Filtros combinados
- **WHEN** una persona tiene activos a la vez el filtro de prioridad y el de estado de completada
- **THEN** ambos viajan en la misma consulta y el resultado incluye solo las tareas que cumplen los dos

#### Scenario: Quitar un filtro
- **WHEN** una persona vuelve un filtro a su valor neutro
- **THEN** la aplicación consulta de nuevo sin ese parámetro y el resultado deja de estar restringido por él

#### Scenario: Combinación sin resultados
- **WHEN** una combinación de filtros no deja ninguna tarea
- **THEN** la pantalla muestra un mensaje de que no hay tareas que cumplan los filtros, no un error

### Requirement: Búsqueda por texto con debounce
La pantalla MUST ofrecer un campo de búsqueda por texto que filtra las tareas por su título y su descripción. La consulta a `GET /api/tareas` con el parámetro de búsqueda MUST dispararse solo después de que la persona deje de escribir durante un intervalo breve (entre 300 y 400 ms), no en cada pulsación de tecla. La búsqueda MUST combinarse con el resto de filtros activos en la misma consulta. Un campo de búsqueda vacío MUST tratarse como ausencia de búsqueda, no como un valor que restringe el resultado.

#### Scenario: La consulta espera a que la persona pare de escribir
- **WHEN** una persona escribe varios caracteres seguidos en el campo de búsqueda
- **THEN** la aplicación no lanza una petición por cada tecla, sino una sola vez transcurrido el intervalo de espera desde la última pulsación

#### Scenario: Búsqueda combinada con filtros
- **WHEN** una persona tiene un texto de búsqueda y además un filtro de prioridad activo
- **THEN** la consulta envía ambos y el resultado incluye solo las tareas que coinciden con el texto y tienen esa prioridad

#### Scenario: Vaciar la búsqueda
- **WHEN** una persona borra todo el texto del campo de búsqueda
- **THEN** la aplicación consulta de nuevo sin el parámetro de búsqueda y el resultado deja de estar restringido por el texto

### Requirement: Ordenación del listado por campo y dirección
La pantalla MUST permitir elegir el criterio de ordenación entre los que admite el backend (fecha de creación, fecha de vencimiento, prioridad y título) y su dirección (ascendente o descendente). Un cambio en el criterio o en la dirección MUST disparar de inmediato una nueva consulta a `GET /api/tareas` con los parámetros de ordenación, combinada con los filtros y la búsqueda activos. Sin elección explícita, el listado MUST mostrarse en el orden por defecto del backend.

#### Scenario: Cambio de criterio de ordenación
- **WHEN** una persona elige ordenar por prioridad
- **THEN** la aplicación consulta de inmediato con ese criterio y muestra las tareas en el orden de negocio de prioridad que devuelve el backend

#### Scenario: Cambio de dirección
- **WHEN** una persona invierte la dirección de la ordenación
- **THEN** la aplicación consulta de nuevo con la dirección elegida y el resultado se reordena en consecuencia

#### Scenario: Ordenación combinada con filtros y búsqueda
- **WHEN** una persona tiene filtros y una búsqueda activos y cambia la ordenación
- **THEN** la nueva consulta envía la ordenación junto con los filtros y la búsqueda vigentes, y el orden se aplica sobre el resultado ya filtrado

### Requirement: Un parámetro de consulta rechazado por el backend se muestra como error, no en silencio
Cuando el backend rechaza la consulta del listado con un `400` porque un parámetro de filtro, de búsqueda o de ordenación no es válido, la aplicación MUST mostrar el componente común de error con un mensaje comprensible y una acción de reintento, y MUST NOT mostrar una lista como si el parámetro no se hubiera enviado.

#### Scenario: El backend rechaza un parámetro
- **WHEN** una consulta del listado termina en `400` por un parámetro no admitido
- **THEN** la pantalla muestra el error de negocio con opción de reintento y no presenta un resultado engañoso
