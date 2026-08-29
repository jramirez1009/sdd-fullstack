## Why

El armazón (`add-frontend-shell`) y la autenticación (`add-frontend-autenticacion`) ya están listos: la aplicación sabe quién es la persona y tiene dónde ponerla, pero todavía no muestra ningún contenido de negocio. Las categorías son la primera pantalla real: son más simples que las tareas (sin filtros, sin asociaciones muchos a muchos) y `add-frontend-tareas` depende de que exista para poder ofrecer un selector de categoría en el formulario de tarea. Los endpoints `/api/categorias` ya existen desde `add-categorias-y-etiquetas`; falta la interfaz que los consume.

## What Changes

- **Hook `useCategorias.js`**: encapsula las cuatro llamadas a `/api/categorias` (GET listar, POST crear, PUT editar, DELETE eliminar) a través de `servicios/api.js`. Es el único punto por el que la pantalla habla con la API, y `add-frontend-tareas` lo reutilizará tal cual para su selector de categoría.
- **`ListaCategorias.jsx`**: muestra todas las categorías del usuario autenticado, ordenadas por nombre, cada una con las acciones de editar y eliminar. Estado vacío explícito cuando la persona no tiene ninguna.
- **`FormularioCategoria.jsx`**: un único componente que crea o edita según reciba o no una categoría existente. Valida en el cliente que el nombre no esté vacío antes de enviar. Un rechazo del backend por nombre duplicado (`409`) se muestra junto al campo de nombre, no como error genérico.
- **Confirmación de borrado**: eliminar una categoría pide confirmación e informa de que las tareas asociadas no se borran, solo quedan sin categoría.
- **Estados de carga y error**: mientras se cargan las categorías o se procesa una acción se muestra `Cargando`; si la carga falla se muestra `MensajeError` con opción de reintentar.
- **Actualización inmediata**: la lista se refresca tras crear, editar o eliminar sin recargar la página (recarga automática de la lista tras la acción exitosa, o actualización optimista).
- **Ruta `/categorias` dentro del `Layout`**: nueva ruta hija del `Layout` existente y nuevo enlace en `Sidebar.jsx`. No se crea ninguna pantalla fuera del armazón.

Sin cambios de ruptura: el backend no se toca; ninguna URL de la API cambia; el comportamiento de autenticación y del armazón es idéntico.

## Capabilities

### New Capabilities

- `frontend-categorias`: la pantalla de gestión de categorías en el cliente web —listar las categorías propias, crear una nueva, renombrar y eliminar una existente—, con validación en el cliente, tratamiento del conflicto de nombre duplicado junto al campo, confirmación antes de borrar, representación visual explícita de carga y error, y actualización de la lista sin recargar la página.

### Modified Capabilities

Ninguna. `frontend-cascaron` ya especifica que la navegación lateral tiene un enlace por cada sección autenticada que exista; añadir la sección de categorías satisface ese requisito sin cambiarlo. `frontend-autenticacion` ya garantiza que toda llamada a la API protegida viaja autenticada; este cambio la consume sin alterarla. `categorias` (backend) no cambia: sus endpoints se consumen tal cual.

## Impact

- **Código nuevo**: `frontend/src/componentes/Categoria/ListaCategorias.jsx`, `FormularioCategoria.jsx` con sus `.module.css`; `frontend/src/hooks/useCategorias.js`.
- **Código modificado**: `frontend/src/servicios/api.js` (funciones `listarCategorias`, `crearCategoria`, `editarCategoria`, `eliminarCategoria`); `frontend/src/App.jsx` (ruta hija `/categorias` bajo `Layout`); `frontend/src/componentes/Layout/Sidebar.jsx` (enlace a `/categorias`).
- **Dependencias nuevas**: ninguna. `react` y `react-router-dom` ya son dependencias del frontend.
- **Especificaciones**: nueva `openspec/specs/frontend-categorias/spec.md`.
- **Sin impacto**: backend, base de datos, contrato de la API, variables de entorno, autenticación, y el armazón.
- **Cambios posteriores habilitados**: `add-frontend-tareas` importa `useCategorias.js` para poblar su selector de categoría.

## Decisiones registradas

- **2026-08-29 — Categorías se construye antes que tareas.** Es la pantalla de contenido más simple (sin filtrado ni asociaciones) y `add-frontend-tareas` necesita `useCategorias.js` para mostrar el selector de categoría; construir primero lo simple y reutilizable reduce el riesgo del cambio grande.
- **2026-08-29 — Un solo `FormularioCategoria.jsx` para crear y editar.** El único dato editable es el nombre; dos componentes casi idénticos divergirían en validación y en el tratamiento del error de duplicado. El modo se deriva de si recibe una categoría existente.
- **2026-08-29 — El conflicto de nombre duplicado (`409`) se muestra junto al campo de nombre.** Es un error corregible que se refiere a un campo concreto; tratarlo como error genérico de página obligaría a la persona a adivinar qué corregir. El resto de fallos (red, `401`, error interno) sí usan la presentación genérica.
- **2026-08-29 — Eliminar pide confirmación y explica el efecto sobre las tareas.** El backend borra de forma incondicional y deja las tareas sin categoría; sin confirmación un clic accidental es irreversible, y sin la explicación la persona podría temer perder tareas.
- **2026-08-29 — Tras una acción exitosa se recarga la lista desde la API.** Es lo más simple y siempre coherente con el servidor (orden por nombre incluido). Una actualización optimista es aceptable si no complica el manejo del rollback ante error.
- **2026-08-29 — Etiquetas no tiene pantalla propia.** El árbol de carpetas del reto no contempla `componentes/Etiqueta/`; las etiquetas se gestionan desde el formulario de tarea en `add-frontend-tareas`.
- **2026-08-29 — Fuera de alcance**: cualquier pantalla o lógica de tareas; el selector de categoría dentro del formulario de tarea (se construye en `add-frontend-tareas`, que importa `useCategorias.js` desde aquí); pantalla de etiquetas; y el diseño visual definitivo más allá de que sea funcional, responsivo y accesible con CSS Modules.
