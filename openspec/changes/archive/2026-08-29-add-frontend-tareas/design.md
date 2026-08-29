## Context

Ver `proposal.md` — Why. Estado del frontend tras `add-frontend-categorias`:

- `App.jsx` usa una ruta de diseño: `<Route element={<RutaProtegida><Layout /></RutaProtegida>}>` con `/tareas` y `/categorias` como rutas hijas del `<Outlet />` del `Layout`. Hoy `/tareas` renderiza el placeholder `paginas/Tareas.jsx`. El comodín `*` redirige a `/tareas`.
- `Sidebar.jsx` construye la navegación desde un array `SECCIONES` y ya incluye `{ a: '/tareas', texto: 'Tareas' }`.
- `componentes/Comunes/` tiene `Cargando.jsx` (`texto`, `enPantallaCompleta`), `MensajeError.jsx` (`children`, `tono` `error|aviso`, `id`), `LimiteDeError.jsx`, `RutaProtegida.jsx`.
- `componentes/Categoria/DialogoConfirmarBorrado.jsx` existe con foco atrapado, cierre con `Esc`, `role="alertdialog"`, estado `eliminando`/`error` y `<Cargando>` mientras la promesa está pendiente. Su texto está hoy acoplado a "categoría" (título, descripción y etiqueta del botón fijos en el JSX). Su único uso es `ListaCategorias.jsx`.
- `servicios/api.js` centraliza HTTP: `peticion(ruta, { metodo, cuerpo, esAutenticacion })` adjunta el JWT, normaliza todo fallo a `ErrorApi` (`estadoHttp`, `codigo`, `mensaje`, `detalles`, `esFalloDeRed`), y ante un `401` no marcado como autenticación llama al manejador de sesión caducada. Expone una función por endpoint; ya tiene las cuatro de categorías.
- `servicios/validacion.js` devuelve `{ campo: motivo }` con la misma forma que los `detalles` de un `DATOS_INVALIDOS` del backend.
- `hooks/useCategorias.js` es la única puerta a `/api/categorias`: expone `categorias`, `cargando`, `error`, `recargar`, `crear`, `editar`, `eliminar`; las acciones reconcilian la lista tras éxito y propagan su error con `throw`. Su diseño ya previó que el selector de categoría de tareas lo reutilizaría tal cual.
- Reglas del proyecto: los componentes de datos usan hooks de `hooks/` para las llamadas (nada de `fetch`/servicios directo en el componente); todo estado de carga y error tiene representación visual con los componentes de `Comunes/`; el árbol del reto fija `componentes/Tarea/` para esta pantalla, `hooks/` para los hooks, `servicios/` para las llamadas, y no contempla `paginas/` ni `componentes/Etiqueta/`.

Backend ya disponible (`add-tareas`, `add-categorias-y-etiquetas`):

- `GET /api/tareas` → array directo. Parámetros de query, todos opcionales y combinables como conjunción: `completada` (booleano), `categoria` (id o el valor reservado `ninguna`), `prioridad` (`baja|media|alta`), `fecha_vencimiento_desde`, `fecha_vencimiento_hasta` (día del calendario), `busqueda` (texto, tope = longitud de un título), `etiquetas` (lista de nombres, insensible a caja), `ordenar` (`creado_en|fecha_vencimiento|prioridad|titulo`), `direccion` (`asc|desc`). Sin parámetros: orden por creación descendente. Parámetro inválido → `400 DATOS_INVALIDOS` señalando el parámetro; parámetros desconocidos se ignoran en silencio.
- Representación de una tarea (idéntica al crear, editar, completar y listar): `{ id (string), titulo, descripcion, categoria (objeto como el de categorías, o vacío), fecha_vencimiento, prioridad, completada, etiquetas (array de objetos como los de etiquetas), creado_en, actualizado_en, completado_en }`.
- `POST /api/tareas` `{ titulo, descripcion?, categoria?, fecha_vencimiento?, prioridad?, etiquetas? }` → `201` con la tarea. `400 DATOS_INVALIDOS` (con `detalles` por campo) para título ausente/vacío/largo, prioridad fuera de conjunto, fecha mal formada o en el pasado. `400` con el código de referencia inválida si la categoría o alguna etiqueta no es del usuario (operación completa falla, no aplica nada).
- `PUT /api/tareas/:id` `{ ... }` → `200` con la tarea. La edición sustituye el contenido: un opcional omitido queda vacío, salvo `etiquetas`, cuya omisión conserva las actuales. No permite cambiar `completada`. `404` si la tarea es ajena o no existe (indistinguible).
- `PATCH /api/tareas/:id/completar` `{ completada: boolean }` → `200` con la tarea. Idempotente: no alterna. `400` si el estado falta o no es booleano. `404` si es ajena.
- `DELETE /api/tareas/:id` → `204` sin cuerpo. `404` si es ajena o ya borrada.
- `GET /api/etiquetas` → array directo ordenado por nombre, cada elemento `{ id (string), nombre, fecha_creacion }`.
- `POST /api/etiquetas` `{ nombre }` → `201` con la etiqueta. `400 DATOS_INVALIDOS`; `409` con código estable si el nombre ya existe para el usuario (insensible a caja).

## Goals / Non-Goals

**Goals:**

- Un hook `useTareas` que sea la única puerta a `/api/tareas` y a `/api/tareas/:id/completar`, que reciba los filtros activos y vuelva a consultar cuando cambian, y que reconcilie la lista tras cada acción.
- Un panel de filtros que traduzca su estado a los parámetros de query del backend uno a uno, aplicando cambios de control al instante y el texto de búsqueda con debounce.
- Un formulario único crear/editar en el que el único campo obligatorio sea el título, que reutilice `useCategorias` para el selector y que asigne etiquetas con autocompletar y creación al vuelo.
- Promover `DialogoConfirmarBorrado` a `Comunes/` parametrizando su texto, sin cambiar su comportamiento de accesibilidad ni el uso existente en categorías.

**Non-Goals:**

- Estado global de tareas o caché entre montajes: el hook vive donde se usa.
- Reproducir en el cliente la lógica de filtrado, búsqueda o ordenación: el backend es la autoridad y la lista se reconcilia desde él.
- Edición en línea dentro de la fila: el formulario es una vista/estado aparte.
- Una pantalla de etiquetas: `useEtiquetas` es solo el soporte del autocompletar.
- Paginación, scroll infinito, virtualización de la lista (fuera de alcance del reto).

## Decisions

### 1. `useTareas(filtros)` recibe los filtros y reconsulta cuando cambian

Firma propuesta:

```
const {
  tareas,            // array del backend, o []
  cargando,          // carga inicial o recarga por cambio de filtros
  error,             // ErrorApi de la carga (incluye el 400 por parámetro inválido), o null
  recargar,          // repite GET /api/tareas con los filtros vigentes
  crear,             // (datos) => Promise<tarea>       — rechaza con ErrorApi
  editar,            // (id, datos) => Promise<tarea>
  eliminar,          // (id) => Promise<void>
  cambiarCompletada, // (id, completada) => Promise<tarea>
} = useTareas(filtros);
```

- `filtros` es un objeto plano ya normalizado a los nombres de query del backend (`{ completada, categoria, prioridad, fecha_vencimiento_desde, fecha_vencimiento_hasta, busqueda, etiquetas, ordenar, direccion }`), con las claves de valor neutro ausentes. El hook lo serializa a `URLSearchParams` en `servicios/api.js`.
- El efecto de carga depende de una versión estable de `filtros` (serializada a cadena) para no reconsultar por identidades de objeto nuevas. Cada consulta cancela la anterior con un `AbortController` o descarta su resultado con un contador de secuencia, para que una respuesta lenta no pise a una más reciente.
- Las acciones llaman a `servicios/api.js` y **tras éxito** invocan `recargar`: el servidor vuelve a aplicar filtros, búsqueda y orden, así la lista queda siempre coherente. El volumen por usuario es moderado y una fusión optimista tendría que replicar toda esa lógica.
- Las acciones **no** capturan su error: lo propagan (`throw`) para que el formulario lo asocie a un campo o el diálogo lo muestre. El `error` del hook es solo el de la *carga de la lista*.
- **Alternativa descartada**: que cada componente tenga su propio `useState` de tareas y coordine. Rompe la regla de una sola puerta a la API y duplica el manejo de cancelación de peticiones.

### 2. El estado de los filtros vive en `ListaTareas`, no en `useTareas` ni en la URL

- `ListaTareas` mantiene `useState` con el estado "de interfaz" de los filtros (lo que el panel muestra) y deriva de él el objeto `filtros` normalizado que pasa a `useTareas`.
- El texto de búsqueda es un estado aparte con debounce: `FiltroTareas` actualiza `busquedaInmediata` en cada tecla (para que el input responda), y un `useEffect` con `setTimeout` de 300–400 ms copia ese valor a `busquedaDebounced`, que es el que entra en `filtros`. Limpiar el input propaga el vacío tras el mismo intervalo; un valor vacío se omite del objeto `filtros`.
- **No** se sincroniza con la query string de la URL. El reto no pide enlaces compartibles ni estado restaurable al recargar; añadir `useSearchParams` acoplaría el panel al router y multiplicaría los casos de parseo. Si se quisiera después, se hace sin tocar la spec.
- **Alternativa descartada**: estado de filtros dentro de `useTareas`. Mezclaría "qué pide la interfaz" con "cómo se habla con la API"; el hook debe poder recibir cualquier conjunto de filtros y nada más.

### 3. `FiltroTareas` traduce controles a parámetros del backend uno a uno

| Control | Parámetro | Valor neutro (omitido) |
|---|---|---|
| Estado | `completada` (select: todas / completadas / pendientes) | "todas" |
| Categoría | `categoria` (select con las categorías de `useCategorias` + "Sin categoría" → `ninguna`) | "todas" |
| Prioridad | `prioridad` (select baja/media/alta) | "todas" |
| Vence desde | `fecha_vencimiento_desde` (`<input type="date">`) | vacío |
| Vence hasta | `fecha_vencimiento_hasta` (`<input type="date">`) | vacío |
| Etiquetas | `etiquetas` (multi-selección sobre `useEtiquetas`) | lista vacía |
| Buscar | `busqueda` (`<input type="search">` con debounce) | vacío |
| Ordenar por | `ordenar` (select creado_en/fecha_vencimiento/prioridad/titulo) | "por defecto" → se omiten `ordenar` y `direccion` |
| Dirección | `direccion` (asc/desc, o un botón de invertir) | según `ordenar` por defecto del backend |

- Cualquier cambio de un `<select>` o `<input type="date">` llama a un `onChange` que actualiza el estado de filtros de `ListaTareas` en el acto → `useTareas` reconsulta. Sin botón "Aplicar".
- El selector de categoría del **filtro** también sale de `useCategorias`, igual que el del formulario. Mientras `useCategorias` carga, el selector muestra un estado deshabilitado; su error no bloquea la lista de tareas (el resto de filtros siguen usables).
- El backend valida los valores; el panel solo ofrece los admitidos, así que un `400` por parámetro inválido sería un bug del cliente — aun así `useTareas` lo trata como error de carga con reintento (Requirement "Un parámetro de consulta rechazado…").

### 4. `useEtiquetas` es un hook mínimo de soporte

```
const {
  etiquetas,   // array ordenado por nombre, o []
  cargando,
  error,
  recargar,
  crear,       // (nombre) => Promise<etiqueta>  — rechaza con ErrorApi (incluye 409)
} = useEtiquetas();
```

- Carga `GET /api/etiquetas` una vez al montar. `crear` hace `POST /api/etiquetas` y, tras éxito, añade la etiqueta a `etiquetas` en memoria (orden por nombre) sin recargar — es una lista de solo lectura para el autocompletar y el coste de un `recargar` completo no aporta.
- No expone editar ni eliminar: el reto no da pantalla de etiquetas y esas operaciones no tienen disparador en esta interfaz.
- Lo consumen `AutocompletarEtiquetas` (sugerencias + creación al vuelo) y el multi-selector de etiquetas de `FiltroTareas` (solo lectura).
- **Alternativa descartada**: llamar a `servicios/api.js` directamente desde `AutocompletarEtiquetas`. Viola la regla de "no servicios directo en el componente" y repetiría el manejo de carga/error.

### 5. `AutocompletarEtiquetas`: sugerir, seleccionar, crear al vuelo

- Entrada controlada con una lista desplegable de sugerencias filtradas de `useEtiquetas().etiquetas` por coincidencia de subcadena insensible a caja, excluyendo las ya seleccionadas.
- Si el texto escrito (recortado) no coincide exactamente con ninguna etiqueta existente y no está vacío, la lista ofrece una opción "Crear «texto»". Al elegirla: `await crear(texto)`; en éxito, se añade el objeto devuelto a la selección y se limpia el input; en error, se muestra el motivo junto al campo (con `ErrorApi.mensaje`, p. ej. el `409` de nombre duplicado) y no se añade nada.
- La selección se representa como un array de objetos etiqueta; al guardar la tarea, `FormularioTarea` envía `etiquetas` como el array de identificadores (cadenas) que el backend espera.
- Quitar una etiqueta seleccionada la retira del array local antes de guardar.
- Foco y teclado: flechas para navegar sugerencias, Enter para elegir la resaltada, Backspace con input vacío retira la última etiqueta. `role="combobox"`/`aria-expanded` en el input y `role="listbox"` en las sugerencias.

### 6. `DialogoConfirmarBorrado` se promueve a `Comunes/` con texto por props

Nueva firma:

```
<DialogoConfirmarBorrado
  titulo="Eliminar tarea"
  descripcion={<>Se eliminará la tarea <strong>{tarea.titulo}</strong>. Esta acción no se puede deshacer.</>}
  etiquetaConfirmar="Eliminar"
  etiquetaEnCurso="Eliminando…"
  alConfirmar={() => eliminar(tarea.id)}
  alCancelar={cerrar}
/>
```

- Se conserva intacto el mecanismo de foco atrapado, cierre con `Esc`, `role="alertdialog"`, el guardado de `enVuelo` contra doble envío, el estado `error` con `<MensajeError>` y `<Cargando>` mientras la promesa está pendiente.
- `alConfirmar` pasa a ser una función sin argumentos (el llamador ya cierra sobre el id/recurso); hoy recibe `categoria.id`. Se ajusta `ListaCategorias.jsx` para pasar `alConfirmar={() => eliminar(categoria.id)}` y los textos actuales ("Eliminar categoría"; el matiz sobre las tareas que quedan sin categoría) como props.
- Archivos: `git mv` de `DialogoConfirmarBorrado.jsx` y `.module.css` de `componentes/Categoria/` a `componentes/Comunes/`; actualizar la ruta de import en `ListaCategorias.jsx` (`../Comunes/…`) y usar la misma en `ItemTarea.jsx`.
- **Alternativa descartada**: dejar el diálogo en `Categoria/` e importarlo desde `Tarea/`. Un componente compartido que vive bajo la carpeta de otra funcionalidad es una trampa de mantenimiento y contradice el papel de `Comunes/`.

### 7. `ListaTareas` es el contenedor con sub-estados; `ItemTarea` es la fila

- `ListaTareas.jsx` (elemento de la ruta `/tareas`): posee el estado de filtros, instancia `useTareas(filtros)`, renderiza `FiltroTareas` (siempre visible) y luego decide el cuerpo:
  - `cargando` → `<Cargando texto="Cargando tareas…" />`.
  - `error` de carga → `<MensajeError>` + botón "Reintentar" → `recargar`.
  - lista vacía sin filtros activos → "Aún no tienes tareas" + acción de crear la primera.
  - lista vacía con filtros activos → "No hay tareas que cumplan los filtros".
  - lista con datos → un `<ItemTarea>` por tarea.
- El formulario se muestra como estado de la pantalla: `null` | `{ modo: 'crear' }` | `{ modo: 'editar', tarea }`. El diálogo de borrado: `aEliminar` = `null` | `tarea`.
- `ItemTarea.jsx` recibe la tarea y callbacks (`alEditar`, `alEliminar`, `alCambiarCompletada`). Muestra título, chip de categoría (si `categoria` no está vacía), prioridad, fecha de vencimiento (si la hay), chips de etiquetas, y el control de completar (checkbox o botón) que llama `alCambiarCompletada(tarea.id, !tarea.completada)` — el `!` se calcula aquí una sola vez sobre el dato recién renderizado, y el hook envía ese booleano explícito a `PATCH …/completar`. Un `useState` local `procesando` (o un `enVuelo` ref) evita la doble activación mientras la promesa está pendiente.
- El identificador de la tarea se trata siempre como cadena (viene así del backend por ser entero de 64 bits); nunca se convierte a número.

### 8. `servicios/api.js` gana siete funciones de endpoint

```
export function listarTareas(filtros)          // GET    /api/tareas?<query>
export function crearTarea(datos)              // POST   /api/tareas
export function editarTarea(id, datos)         // PUT    /api/tareas/:id
export function cambiarCompletada(id, done)    // PATCH  /api/tareas/:id/completar   { completada: done }
export function eliminarTarea(id)              // DELETE /api/tareas/:id
export function listarEtiquetas()              // GET    /api/etiquetas
export function crearEtiqueta(nombre)          // POST   /api/etiquetas              { nombre }
```

- `listarTareas` construye la query con `URLSearchParams`: omite claves con valor neutro, y para `etiquetas` añade una entrada repetida por elemento (o el formato que ya use el backend; se confirma leyendo su parser en implementación).
- Todas usan `peticion(...)` sin marca `esAutenticacion`: el JWT y la reacción al `401` (sesión caducada) ya están cubiertos. `eliminarTarea` tolera el `204` sin cuerpo (`peticion` devuelve `null`).
- El núcleo de `peticion` no se toca.

### 9. Validación de cliente: solo "título no vacío"

`FormularioTarea` comprueba `titulo.trim() !== ''` antes de llamar. No replica longitud máxima, conjunto de prioridades, NFC, rechazo de controles ni "fecha no en el pasado": son reglas de negocio del backend y una segunda copia se desincroniza (misma filosofía que `servicios/validacion.js`). Un `400` con `detalles` se reparte por campo: `detalles.titulo` junto al título, `detalles.prioridad` junto al selector de prioridad, `detalles.fecha_vencimiento` junto a la fecha; el código de referencia inválida (categoría/etiqueta ajena) se muestra como error general del formulario con `<MensajeError>`. Se puede añadir `maxLength`/`min` en los inputs como ayuda de UX sin tratarlo como validación autoritativa.

## Risks / Trade-offs

- **Reconsultar en cada cambio de filtro genera varias peticiones si la persona ajusta varios controles seguidos** → Los controles no-texto cambian de forma deliberada y espaciada; el buscador, que sí genera ráfagas, tiene debounce. La cancelación por secuencia/`AbortController` evita que respuestas fuera de orden pinten datos viejos. Si se notara, se puede añadir un debounce corto también a los selects sin tocar la spec.
- **Recargar la lista completa tras cada acción hace una petición extra** → Coste moderado y garantía de coherencia con el filtrado/orden del servidor. Migrable a fusión optimista después sin cambiar la spec.
- **Promover `DialogoConfirmarBorrado` cambia la firma de `alConfirmar` (de `(id)` a `()`)** → Es un único llamador existente (`ListaCategorias`), que se actualiza en el mismo cambio; el comportamiento observable de la confirmación de categorías no cambia (mismos textos, mismo flujo).
- **`useEtiquetas` añade estado de etiquetas en cada montaje del formulario/filtro** → Es una lista pequeña; si dos consumidores coexisten (filtro y formulario abiertos) se hacen dos `GET /api/etiquetas`. Aceptable; un contexto compartido sería sobre-ingeniería para el tamaño del reto.
- **Crear una etiqueta al vuelo y luego cancelar el formulario deja la etiqueta creada en el backend** → Es coherente con "crear al vuelo dispara `POST` de inmediato"; la etiqueta huérfana es inocua y la persona puede reutilizarla. No se intenta deshacer.
- **Condición de carrera al completar desde una vista desfasada** → Se envía el estado deseado explícito y el endpoint es idempotente; el peor caso es un `PATCH` redundante que deja la tarea como ya estaba.
- **`/tareas` abierta directamente sin sesión** → Cubierto por `RutaProtegida` en la ruta de diseño, sin código nuevo.

## Migration Plan

1. `servicios/api.js`: añadir las siete funciones de tareas y etiquetas.
2. `git mv` `DialogoConfirmarBorrado.{jsx,module.css}` a `componentes/Comunes/`; parametrizar su texto por props y cambiar `alConfirmar` a función sin argumentos.
3. Actualizar `ListaCategorias.jsx`: nueva ruta de import y paso de textos + `alConfirmar={() => eliminar(categoria.id)}`. Verificar que la confirmación de categorías sigue igual.
4. Crear `hooks/useEtiquetas.js` y `hooks/useTareas.js`.
5. Crear `componentes/Tarea/AutocompletarEtiquetas.jsx` + `.module.css`.
6. Crear `componentes/Tarea/FormularioTarea.jsx` + `.module.css` (crear/editar, selector de categoría con `useCategorias`, etiquetas con el autocompletar, errores por campo).
7. Crear `componentes/Tarea/ItemTarea.jsx` + `.module.css` (fila, control de completar explícito, editar/eliminar con el diálogo común).
8. Crear `componentes/Tarea/FiltroTareas.jsx` + `.module.css` (controles al instante, búsqueda con debounce, orden + dirección).
9. Crear `componentes/Tarea/ListaTareas.jsx` + `.module.css` (estado de filtros, sub-estados, orquestación de formulario y diálogo).
10. `App.jsx`: `/tareas` → `<ListaTareas />`; quitar el import de `paginas/Tareas.jsx`. Borrar `paginas/Tareas.jsx` y `paginas/Tareas.module.css`; retirar la carpeta `paginas/` si queda vacía.
11. Verificación manual: ver la lista; filtrar por cada control y comprobar que la consulta se dispara al instante; escribir en el buscador y comprobar una sola petición tras la pausa; combinar filtros + búsqueda + orden; crear una tarea solo con título; crear otra con todos los campos y una etiqueta nueva al vuelo; editar; completar y descompletar; eliminar con confirmación; forzar un fallo de red en la carga y usar "Reintentar"; recargar en `/tareas` con sesión; comprobar la confirmación de borrado de categorías tras el movimiento del diálogo.
12. `npm run build` en `frontend/` y `openspec validate add-frontend-tareas --strict`.

Rollback: revertir el commit. Sin estado persistente ni migración de datos; el backend no se toca. (La única huella externa posible es alguna etiqueta creada durante pruebas, inocua.)

## Open Questions

- Formato exacto de la query para `etiquetas` (clave repetida vs. lista separada por comas): se confirma leyendo el parser del backend en implementación; no afecta a la spec ni al desglose de tareas.
- Presentación visual del panel de filtros (barra superior, columna lateral, colapsable en móvil) y de los chips de categoría/etiqueta: se afina en implementación con CSS Modules; no afecta a la spec.
