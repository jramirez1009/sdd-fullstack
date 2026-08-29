## Context

Ver `proposal.md` — Why. Estado del frontend tras `add-frontend-shell`:

- `App.jsx` usa una ruta de diseño: `<Route element={<RutaProtegida><Layout /></RutaProtegida>}>` con `/tareas` como única ruta hija en el `<Outlet />` del `Layout`. El comodín `*` redirige a `/tareas`.
- `Sidebar.jsx` construye la navegación desde un array `SECCIONES` (`{ a, texto }`) y usa `NavLink`; hoy solo tiene `/tareas`. Recibe `alNavegar` para cerrar el panel móvil.
- `componentes/Comunes/` tiene `Cargando.jsx` (`texto`, `enPantallaCompleta`), `MensajeError.jsx` (`children`, `tono` `error|aviso`, `id`), `LimiteDeError.jsx`, `RutaProtegida.jsx`.
- `servicios/api.js` centraliza HTTP: adjunta el JWT, normaliza todo fallo a `ErrorApi` (`estadoHttp`, `codigo`, `mensaje`, `detalles`, `esFalloDeRed`), y ante un `401` no marcado como autenticación llama al manejador de sesión caducada. Expone una función por endpoint (`registrar`, `login`, `perfil`). No hay funciones de categorías todavía.
- `servicios/validacion.js` devuelve `{ campo: motivo }` con la misma forma que los `detalles` de un `DATOS_INVALIDOS` del backend, para que los formularios pinten errores por campo desde una única estructura.
- Los formularios de datos usan hooks de `hooks/` para las llamadas; nada de `fetch`/servicios directo en el componente (regla del proyecto).
- Árbol del reto: `componentes/Categoria/` para los componentes de esta pantalla; `hooks/` para el hook; `servicios/` para las llamadas. Sin carpeta `paginas/` nueva.

Backend ya disponible (`add-categorias-y-etiquetas`):

- `GET /api/categorias` → array directo, ordenado por nombre, cada elemento `{ id (string), nombre, fecha_creacion }`.
- `POST /api/categorias` `{ nombre }` → `201` con la categoría; `400` `DATOS_INVALIDOS` (con `detalles.nombre`); `409` `NOMBRE_DUPLICADO`.
- `PUT /api/categorias/:id` `{ nombre }` → `200` con la categoría; `400`; `404` (inexistente o ajena); `409` `NOMBRE_DUPLICADO`.
- `DELETE /api/categorias/:id` → `204` sin cuerpo; `404` (inexistente, ajena o ya borrada). Borrado incondicional: las tareas quedan sin categoría.
- Límite de nombre: 1–100 caracteres. Unicidad por usuario, insensible a mayúsculas/minúsculas.

## Goals / Non-Goals

**Goals:**

- Un hook `useCategorias` que sea la única puerta a `/api/categorias`, con una API pequeña y reutilizable tal cual desde `add-frontend-tareas`.
- Una pantalla que cubra los estados de carga, error de carga con reintento, lista vacía, y las tres acciones (crear/editar/eliminar) con su estado en curso.
- El `409` de nombre duplicado tratado como error de campo, no de página.

**Non-Goals:**

- Selector de categoría en el formulario de tarea (lo hace `add-frontend-tareas`).
- Paginación, búsqueda o filtro de categorías (el backend no los ofrece y el reto no los pide).
- Edición en línea dentro de la fila de la lista: el formulario es una vista/estado aparte.
- Caché entre montajes o estado global de categorías: el hook vive donde se use.

## Decisions

### 1. `useCategorias` mantiene la lista en estado y expone acciones que la reconcilian

Firma propuesta:

```
const {
  categorias,        // array ordenado por nombre, o []
  cargando,          // carga inicial / recarga de la lista
  error,             // ErrorApi de la carga, o null
  recargar,          // vuelve a pedir GET /api/categorias
  crear,             // (nombre) => Promise<categoria>  — rechaza con ErrorApi
  editar,            // (id, nombre) => Promise<categoria>
  eliminar,          // (id) => Promise<void>
} = useCategorias();
```

- Al montar, hace `GET` una vez. `recargar` es la acción de reintento tras un fallo de carga.
- `crear`/`editar`/`eliminar` llaman a `servicios/api.js`, y **tras éxito** actualizan el estado local: se re-solicita la lista (`recargar`) para quedar siempre coherente con el orden por nombre del servidor. Es lo más simple y el volumen de categorías de un usuario es pequeño; una fusión optimista en memoria tendría que replicar la ordenación y el criterio de unicidad insensible a mayúsculas.
- Las acciones **no** capturan su error: lo propagan (`throw`) para que el formulario o la fila decidan cómo mostrarlo (campo vs. genérico). El hook solo posee el error de la *carga de la lista*.
- **Alternativa descartada**: que el hook exponga un único `error` para todo. Mezclaría el fallo de carga (va en la pantalla, con reintento) con el fallo de una acción (va en el formulario, a veces junto al campo).

### 2. `servicios/api.js` gana cuatro funciones de endpoint, sin cambiar su núcleo

```
export function listarCategorias()            // GET  /api/categorias
export function crearCategoria(nombre)        // POST /api/categorias      { nombre }
export function editarCategoria(id, nombre)   // PUT  /api/categorias/:id  { nombre }
export function eliminarCategoria(id)         // DELETE /api/categorias/:id
```

Usan `peticion(...)` tal cual: el JWT y la reacción al `401` (sesión caducada) ya están cubiertos por el núcleo, sin marca `esAutenticacion`. `eliminarCategoria` devuelve el `null` que `peticion` produce ante un `204` sin cuerpo.

### 3. El `409 NOMBRE_DUPLICADO` se distingue por su `codigo`, no por su texto

`FormularioCategoria` envuelve la llamada del hook en `try/catch`. En el `catch`:

- Si `err instanceof ErrorApi && err.codigo === 'NOMBRE_DUPLICADO'` → se guarda como error del campo `nombre` y se muestra pegado al input (mismo patrón visual que `detalles.nombre` de un `400`).
- Si `err.codigo === 'DATOS_INVALIDOS'` → se leen `err.detalles?.nombre` y se pinta igual, junto al campo.
- Cualquier otro (`esFalloDeRed`, `ERROR_INTERNO`, …) → se muestra con `<MensajeError>` genérico en el formulario.

El código `NOMBRE_DUPLICADO` es estable e independiente del texto (verificado en `backend/src/utils/errores.js`); el `recurso` viaja en `detalles` y no hace falta aquí.

### 4. La confirmación de borrado usa un diálogo propio, no `window.confirm`

`window.confirm` no permite el texto explicativo sobre las tareas de forma accesible ni encaja con CSS Modules. Se añade un componente de confirmación pequeño (en `componentes/Categoria/` o reutilizando un `Comunes/` si más adelante otra pantalla lo necesita — por ahora local a Categoría) con:

- Texto fijo: la categoría se eliminará y *las tareas asociadas no se borran, quedarán sin categoría*.
- Botones "Eliminar" / "Cancelar"; foco atrapado mientras está abierto; `Esc` cancela.
- "Eliminar" invoca `eliminar(id)` del hook; mientras la promesa está pendiente, el botón queda deshabilitado y se muestra `<Cargando>`.

**Alternativa descartada**: `window.confirm` — bloquea el hilo, no se puede estilar, y su texto no puede tener el matiz accesible que pide la spec.

### 5. La pantalla es un componente contenedor `ListaCategorias` con sub-estados

`ListaCategorias.jsx` consume `useCategorias()` y decide qué pintar:

- `cargando` → `<Cargando texto="Cargando categorías…" />`.
- `error` (de carga) → `<MensajeError>` + botón "Reintentar" que llama a `recargar`.
- lista vacía → mensaje "Aún no tienes categorías" + acción para crear la primera.
- lista con datos → tabla/lista de filas; cada fila con nombre y botones editar/eliminar.
- El formulario (`FormularioCategoria`) se muestra como estado de la pantalla: `null` (oculto) | `{ modo: 'crear' }` | `{ modo: 'editar', categoria }`. Al enviar con éxito, se cierra y la lista ya está reconciliada por el hook.

El estado "acción en curso" (crear/editar/eliminar) lo posee cada disparador (el formulario para crear/editar, el diálogo para eliminar) mediante un `useState` local `enviando`, que deshabilita el submit y evita el doble envío.

### 6. Nueva ruta `/categorias` y enlace en el Sidebar

- `App.jsx`: añadir `<Route path="/categorias" element={<ListaCategorias />} />` como hija de la ruta de diseño existente (dentro del `<Outlet />` del `Layout`). No se toca `RutaProtegida` ni el comodín.
- `Sidebar.jsx`: añadir `{ a: '/categorias', texto: 'Categorías' }` al array `SECCIONES`. `NavLink` da el marcado de activo automáticamente.
- No se cambia el destino del comodín `*` (sigue a `/tareas`).

### 7. Validación de cliente: solo "nombre no vacío"

`FormularioCategoria` comprueba `nombre.trim() !== ''` antes de llamar. No replica el límite de 100 caracteres ni la normalización NFC ni el rechazo de caracteres de control: son reglas de negocio del backend y una segunda copia se desincroniza (misma filosofía que `servicios/validacion.js`). Un `400` del backend por longitud u otra causa se muestra junto al campo vía `err.detalles.nombre`. Se puede añadir un `maxLength` en el `<input>` como ayuda de UX sin tratarlo como validación autoritativa.

## Risks / Trade-offs

- **Recargar la lista tras cada acción hace una petición extra** → El coste es mínimo (lista pequeña, un usuario) y evita bugs de ordenación/consistencia. Si se notara lentitud, se puede pasar a fusión optimista sin cambiar la spec.
- **El diálogo de confirmación es código nuevo de accesibilidad (foco atrapado, `Esc`)** → Se mantiene mínimo y local a Categoría; si otra pantalla necesita confirmar algo, se promueve a `Comunes/` entonces, no ahora.
- **Doble fuente para el error de nombre (`400` con `detalles.nombre` y `409 NOMBRE_DUPLICADO`)** → Se unifican en el `catch` a una sola variable `errorNombre`, de modo que la vista solo lee una.
- **Una condición de carrera: crear/editar con un nombre que otra pestaña acaba de usar** → El backend responde `409` y el formulario lo muestra junto al campo; la persona reintenta. No se necesita bloqueo.
- **`/categorias` abierta directamente sin sesión** → Cubierto por `RutaProtegida` en la ruta de diseño, sin código nuevo.

## Migration Plan

1. Añadir las cuatro funciones de categorías a `servicios/api.js`.
2. Crear `hooks/useCategorias.js`.
3. Crear `componentes/Categoria/FormularioCategoria.jsx` + `.module.css` (crear/editar, error de nombre junto al campo).
4. Crear el diálogo de confirmación de borrado + `.module.css`.
5. Crear `componentes/Categoria/ListaCategorias.jsx` + `.module.css` (sub-estados carga/error/vacío/lista, orquesta el formulario y el diálogo).
6. `App.jsx`: ruta hija `/categorias`. `Sidebar.jsx`: entrada en `SECCIONES`.
7. Verificación manual: navegar a Categorías desde el Sidebar; lista vacía → crear la primera; crear una segunda; renombrar; intentar un nombre duplicado y ver el error junto al campo; eliminar con confirmación y comprobar que la lista se actualiza; forzar un fallo de red en la carga y usar "Reintentar"; recargar en `/categorias` con sesión; comprobar que el enlace queda activo.
8. `npm run build` en `frontend/` y `openspec validate add-frontend-categorias --strict`.

Rollback: revertir el commit. Sin estado persistente ni migración de datos; el backend no se toca.

## Open Questions

- El estilo visual del diálogo de confirmación y de la lista se afina en implementación; no afecta a la spec ni al desglose de tareas.
