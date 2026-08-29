## 1. Capa de servicios de la API

- [x] 1.1 Añadir a `frontend/src/servicios/api.js` las funciones `listarCategorias()` (`GET /api/categorias`), `crearCategoria(nombre)` (`POST`, cuerpo `{ nombre }`), `editarCategoria(id, nombre)` (`PUT /api/categorias/:id`, cuerpo `{ nombre }`) y `eliminarCategoria(id)` (`DELETE /api/categorias/:id`), todas apoyadas en `peticion(...)` sin marca `esAutenticacion`. Verificar: cada función usa la ruta y el método correctos y `eliminarCategoria` tolera el `204` sin cuerpo (devuelve `null`); `npm run build` en `frontend/` compila sin errores.

## 2. Hook `useCategorias`

- [x] 2.1 Crear `frontend/src/hooks/useCategorias.js` que al montar hace `listarCategorias()` una vez y mantiene `categorias` (array, `[]` por defecto), `cargando` y `error` (el `ErrorApi` de la carga, o `null`), y expone `recargar`. Verificar: al montar con la API disponible, `categorias` queda poblado y `cargando` pasa a `false`; con la API caída, `error` queda con el `ErrorApi` y `categorias` sigue `[]`.
- [x] 2.2 Añadir al hook las acciones `crear(nombre)`, `editar(id, nombre)` y `eliminar(id)` que llaman a la capa de servicios y, **solo tras éxito**, reconcilian la lista invocando `recargar`; las acciones propagan su error (`throw`) en lugar de guardarlo en el `error` del hook. Verificar: tras un `crear` exitoso la lista incluye la nueva categoría en orden por nombre; un `crear` que rechaza deja la lista intacta y la promesa rechaza con el `ErrorApi`.

## 3. Formulario de crear / editar

- [x] 3.1 Crear `frontend/src/componentes/Categoria/FormularioCategoria.jsx` con un único campo `nombre`, que opera en modo crear si no recibe `categoria` y en modo editar si la recibe (parte de `categoria.nombre`). Antes de enviar comprueba `nombre.trim() !== ''`; si falla, marca el campo como inválido y no llama a la API. Verificar: enviar con el nombre vacío o solo espacios señala el campo y no dispara ninguna petición; en modo editar el campo aparece precargado con el nombre actual.
- [x] 3.2 En el envío, envolver la llamada al hook (`crear`/`editar`) en `try/catch`: si `err.codigo === 'NOMBRE_DUPLICADO'` o `err.codigo === 'DATOS_INVALIDOS'` (leyendo `err.detalles?.nombre`), mostrar el mensaje **junto al campo de nombre**, conservando el valor escrito; cualquier otro error se muestra con `<MensajeError>` genérico dentro del formulario. Verificar: enviar un nombre que ya existe (ignorando mayúsculas/minúsculas) muestra el aviso de duplicado pegado al input sin cerrar el formulario y sin borrar lo escrito; un fallo de red muestra el `<MensajeError>` genérico.
- [x] 3.3 Mantener un estado local `enviando` que deshabilita el botón de envío mientras la promesa está pendiente y muestra `<Cargando>`, impidiendo el doble envío; al tener éxito, notificar al contenedor para que cierre el formulario. Verificar: pulsar "Guardar" dos veces seguidas solo genera una petición; tras el éxito el formulario se cierra.
- [x] 3.4 Crear `FormularioCategoria.module.css` con el estilo del formulario y del error de campo (CSS Modules). Verificar: el error de nombre se ve asociado visualmente al input y la pantalla se lee sin desplazamiento horizontal en ventana estrecha.

## 4. Confirmación de borrado

- [x] 4.1 Crear un componente de diálogo de confirmación de borrado en `frontend/src/componentes/Categoria/` (con su `.module.css`) cuyo texto explica que la categoría se eliminará y que **las tareas asociadas no se borran, quedarán sin categoría**; botones "Eliminar" y "Cancelar"; `Esc` cancela y el foco queda atrapado mientras está abierto. Verificar: abrir el diálogo y pulsar "Cancelar" o `Esc` no dispara ninguna petición y la categoría permanece; el texto sobre las tareas es visible.
- [x] 4.2 Al confirmar, invocar `eliminar(id)` del hook con el botón "Eliminar" deshabilitado y `<Cargando>` visible mientras la promesa está pendiente; si `eliminar` rechaza, mostrar el motivo con `<MensajeError>` y dejar reintentar. Verificar: confirmar un borrado exitoso cierra el diálogo y la categoría desaparece de la lista sin recargar la página; un borrado que falla mantiene el diálogo con el error y permite reintentar.

## 5. Pantalla de lista

- [x] 5.1 Crear `frontend/src/componentes/Categoria/ListaCategorias.jsx` que consume `useCategorias()` y renderiza los sub-estados: `cargando` → `<Cargando texto="Cargando categorías…" />`; `error` de carga → `<MensajeError>` + botón "Reintentar" que llama a `recargar`; lista vacía → mensaje "Aún no tienes categorías" con acción para crear la primera; lista con datos → una fila por categoría (ordenadas por nombre) con su nombre y botones "Editar" y "Eliminar". Verificar: cada sub-estado se observa forzando su condición (API lenta, API caída, usuario sin categorías, usuario con categorías).
- [x] 5.2 Orquestar el formulario y el diálogo desde `ListaCategorias`: estado `formulario` (`null` | `{ modo: 'crear' }` | `{ modo: 'editar', categoria }`) y estado `aEliminar` (`null` | `categoria`); al cerrarse con éxito, la lista ya está reconciliada por el hook. Verificar: crear, editar y eliminar desde la lista reflejan el resultado de inmediato (aparece / cambia el nombre / desaparece) manteniendo el orden por nombre, sin recargar la página.
- [x] 5.3 Crear `ListaCategorias.module.css` (CSS Modules). Verificar: la lista y sus acciones se leen sin desplazamiento horizontal en ventana ancha y estrecha dentro del `Layout`.

## 6. Integración de ruta y navegación

- [x] 6.1 En `frontend/src/App.jsx` añadir `<Route path="/categorias" element={<ListaCategorias />} />` como ruta hija de la ruta de diseño existente (dentro del `<Outlet />` del `Layout`), sin tocar `RutaProtegida` ni el comodín `*`. Verificar: abrir `/categorias` con sesión muestra la pantalla dentro del armazón; sin sesión redirige a `/login`.
- [x] 6.2 En `frontend/src/componentes/Layout/Sidebar.jsx` añadir `{ a: '/categorias', texto: 'Categorías' }` al array `SECCIONES`. Verificar: el enlace "Categorías" aparece en la navegación lateral, navega a la pantalla y queda marcado como activo (`aria-current="page"`) cuando está a la vista; en ventana estrecha el panel se cierra tras elegirlo.

## 7. Verificación integral

- [x] 7.1 Recorrido manual completo: entrar a Categorías desde el Sidebar con un usuario sin categorías → estado vacío → crear la primera → crear una segunda → renombrar una → intentar un nombre duplicado y ver el error junto al campo → eliminar una confirmando y comprobar que la lista se actualiza al instante → forzar un fallo de red en la carga inicial y usar "Reintentar" → recargar en `/categorias` con sesión y comprobar que no hay parpadeo ni pérdida del armazón. Verificar: todos los escenarios de `openspec/changes/add-frontend-categorias/specs/frontend-categorias/spec.md` se observan.
- [x] 7.2 Ejecutar `npm run build` en `frontend/` y `openspec validate add-frontend-categorias --strict`. Verificar: build sin errores y validación sin fallos.
