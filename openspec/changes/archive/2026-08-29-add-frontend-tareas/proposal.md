## Why

Con la autenticación (`add-frontend-autenticacion`), el armazón (`add-frontend-shell`) y las categorías (`add-frontend-categorias`) ya construidos, el frontend sabe quién es la persona, tiene dónde ponerla y muestra su primera pantalla de negocio, pero la pantalla central del reto —las tareas— sigue siendo un placeholder. Este cambio cierra la funcionalidad de negocio del cliente: consumir todos los endpoints de tareas de `add-tareas`, incluida toda la capacidad de filtrado, búsqueda y ordenación avanzada que expone `GET /api/tareas`.

## What Changes

- **Hook `useTareas.js`**: encapsula, a través de `servicios/api.js`, las llamadas a `GET/POST/PUT/DELETE /api/tareas` y a `PATCH /api/tareas/:id/completar`. Recibe el conjunto de filtros activos y es el único punto por el que la pantalla de tareas habla con la API. Mantiene la lista en estado y la reconcilia tras cada acción exitosa sin recargar la página.
- **Hook `useEtiquetas.js`**: hook pequeño y nuevo que encapsula `GET /api/etiquetas` (para sugerir etiquetas existentes) y `POST /api/etiquetas` (para crear una al vuelo). No hay pantalla de etiquetas —el árbol del reto no contempla `componentes/Etiqueta/`— pero el campo de autocompletar necesita esas dos llamadas y la regla del proyecto prohíbe `fetch` directo en el componente.
- **`ListaTareas.jsx`** (en `componentes/Tarea/`): obtiene y muestra las tareas del usuario autenticado vía `useTareas.js`, combinando los filtros activos definidos en `FiltroTareas.jsx`. Cubre los estados de carga, error de carga con reintento, lista vacía y lista con resultados. Orquesta el formulario de alta/edición y el diálogo de confirmación de borrado. Es el elemento de la ruta `/tareas`, en sustitución del placeholder.
- **`FiltroTareas.jsx`**: panel de filtros que aplica cada cambio al instante —completada, categoría (incluido el valor reservado "ninguna"), prioridad, rango de fecha de vencimiento, etiquetas y orden (`ordenar` + `direccion`)— disparando de inmediato una nueva consulta a `GET /api/tareas`, sin botón de aplicar. El campo de búsqueda por texto usa debounce (300–400 ms) antes de disparar la consulta. Todos los filtros son combinables y viajan juntos como parámetros de la misma petición.
- **`ItemTarea.jsx`**: muestra una tarea individual —título, categoría (si tiene), prioridad, fecha de vencimiento (si tiene) y sus etiquetas— y un control para marcarla completada/incompleta que llama a `PATCH .../completar` con el estado explícito deseado (no un toggle ciego). Ofrece las acciones de editar y eliminar.
- **`FormularioTarea.jsx`**: un único componente que crea o edita según reciba o no una tarea existente. Solo el título es obligatorio; categoría, descripción, fecha de vencimiento y etiquetas son opcionales. El selector de categoría reutiliza `useCategorias.js` de `add-frontend-categorias` sin reimplementar esa llamada.
- **`AutocompletarEtiquetas.jsx`**: campo de asignación de etiquetas que, al escribir, sugiere etiquetas existentes del usuario; si el texto no coincide con ninguna, ofrece crearla al vuelo (`POST /api/etiquetas` vía `useEtiquetas.js`) y la añade de inmediato a la selección de la tarea en edición.
- **Mover `DialogoConfirmarBorrado.jsx`** de `componentes/Categoria/` a `componentes/Comunes/`, generalizando su texto por props para que sirva tanto a categorías como a tareas. Se actualiza su único uso actual en `ListaCategorias.jsx` y se reutiliza igual en `ItemTarea.jsx`.
- **`servicios/api.js`** gana las funciones de endpoint de tareas (`listarTareas(filtros)`, `crearTarea`, `editarTarea`, `eliminarTarea`, `cambiarCompletada`) y de etiquetas (`listarEtiquetas`, `crearEtiqueta`).
- **`App.jsx`**: la ruta hija `/tareas` pasa a renderizar `ListaTareas`; se elimina `paginas/Tareas.jsx` y su `.module.css`. El enlace del `Sidebar` a `/tareas` ya existe y no cambia.

Sin cambios de ruptura: el backend no se toca; ninguna URL de la API cambia; el comportamiento de autenticación, del armazón y de la pantalla de categorías es idéntico (el diálogo movido se comporta igual).

## Capabilities

### New Capabilities

- `frontend-tareas`: la pantalla de gestión de tareas en el cliente web —listar las tareas propias con su categoría y etiquetas embebidas, crear una tarea, editarla, eliminarla con confirmación y marcarla completada o no completada de forma explícita— junto con el filtrado avanzado (estado, categoría incluida la ausencia de categoría, prioridad, rango de fecha de vencimiento, etiquetas), la búsqueda por texto con debounce, la ordenación por campo y dirección, la asignación de etiquetas con autocompletar y creación al vuelo, la reutilización del selector de categoría del hook de categorías, la representación visual explícita de carga y error con reintento, y la actualización de la lista sin recargar la página.

### Modified Capabilities

Ninguna. `frontend-cascaron` ya especifica que la navegación lateral tiene un enlace por cada sección autenticada; la sección de tareas ya existe como placeholder y su enlace no cambia. `frontend-autenticacion` ya garantiza que toda llamada protegida viaja autenticada; este cambio la consume sin alterarla. `frontend-categorias` no cambia a nivel de comportamiento observable: su spec no fija en qué carpeta vive el diálogo de confirmación, solo que la eliminación pide confirmación y explica su efecto, lo que se mantiene. `tareas` y `etiquetas` (backend) no cambian: sus endpoints se consumen tal cual.

## Impact

- **Código nuevo**: `frontend/src/componentes/Tarea/ListaTareas.jsx`, `FiltroTareas.jsx`, `ItemTarea.jsx`, `FormularioTarea.jsx`, `AutocompletarEtiquetas.jsx` con sus `.module.css`; `frontend/src/hooks/useTareas.js`, `frontend/src/hooks/useEtiquetas.js`.
- **Código movido**: `frontend/src/componentes/Categoria/DialogoConfirmarBorrado.jsx` (+ `.module.css`) → `frontend/src/componentes/Comunes/`, con el texto parametrizado por props.
- **Código modificado**: `frontend/src/servicios/api.js` (funciones de tareas y de etiquetas); `frontend/src/App.jsx` (ruta `/tareas` → `ListaTareas`, eliminación del import del placeholder); `frontend/src/componentes/Categoria/ListaCategorias.jsx` (nueva ruta de import del diálogo y paso de textos por props).
- **Código eliminado**: `frontend/src/paginas/Tareas.jsx` y `frontend/src/paginas/Tareas.module.css` (placeholder que deja de usarse; la carpeta `paginas/` queda vacía y también se retira).
- **Dependencias nuevas**: ninguna. `react` y `react-router-dom` ya son dependencias del frontend; el debounce se implementa con `setTimeout`/`useEffect`.
- **Especificaciones**: nueva `openspec/specs/frontend-tareas/spec.md`.
- **Sin impacto**: backend, base de datos, contrato de la API, variables de entorno, autenticación y el armazón.

## Decisiones registradas

- **2026-08-29 — Tareas se construye en último lugar del frontend base.** Es la pantalla con más superficie (filtros combinables, búsqueda, orden, asociaciones muchos a muchos) y depende de que `useCategorias.js` y el armazón ya existan; construir antes lo simple y reutilizable reduce el riesgo de este cambio.
- **2026-08-29 — `useEtiquetas.js` es un hook nuevo, no una pantalla.** El árbol de carpetas del reto no contempla `componentes/Etiqueta/`, pero la regla del proyecto prohíbe `fetch` directo en un componente. Un hook pequeño en `hooks/` para `GET`/`POST /api/etiquetas` respeta ambas restricciones y da al autocompletar su única puerta a la API.
- **2026-08-29 — `DialogoConfirmarBorrado.jsx` se promueve a `Comunes/`.** El diseño de `add-frontend-categorias` ya previó promoverlo "cuando otra pantalla necesite confirmar algo"; tareas es esa pantalla. El texto (título, descripción, etiqueta del botón) pasa a recibirse por props para no acoplar el componente a un recurso concreto.
- **2026-08-29 — El control de completar envía el estado explícito deseado, no un toggle.** El endpoint `PATCH /api/tareas/:id/completar` recibe el estado explícito y es idempotente; enviar el estado deseado (y no "lo contrario de lo que hay") evita condiciones de carrera si la vista está desfasada.
- **2026-08-29 — Los filtros se aplican al instante; solo la búsqueda por texto usa debounce.** Cambiar un desplegable o una casilla es una acción deliberada y poco frecuente: disparar la consulta de inmediato da la respuesta más directa. Teclear en el buscador genera un evento por tecla, así que se espera (300–400 ms) a que la persona pare antes de consultar.
- **2026-08-29 — La lista se reconcilia desde la API tras cada acción exitosa.** Es lo más simple y siempre coherente con el servidor, que es quien aplica el filtrado, la búsqueda y la ordenación; una fusión optimista tendría que replicar toda esa lógica en el cliente y desincronizarse.
- **2026-08-29 — El cliente valida solo "título no vacío" antes de enviar.** El resto de reglas (longitud, prioridad admitida, fecha no pasada, propiedad de categoría y etiquetas) son de negocio del backend; una segunda copia se desincroniza. Un `400` del backend se muestra junto al campo correspondiente vía `err.detalles`.
- **2026-08-29 — Fuera de alcance**: las 10 consultas SQL de inteligencia de negocio (no son parte del frontend); paginación de resultados (el reto no la exige); drag and drop, tema oscuro, exportar CSV/JSON, atajos de teclado y demás características bonus (posible trabajo aparte); el diseño visual definitivo más allá de que sea funcional, responsivo y accesible con CSS Modules.
