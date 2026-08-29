## Context

Ver `proposal.md` — Why. El estado actual del frontend tras `add-frontend-autenticacion` y `fix-estructura-frontend-auth`:

- `main.jsx` monta `BrowserRouter` → `ProveedorAuth` → `App`.
- `App.jsx` define tres rutas planas (`/login`, `/registro`, `/tareas`) más un comodín que redirige a `/tareas`. Las rutas de sesión están envueltas en `RutaSoloAnonima`; `/tareas` en `RutaProtegida`.
- `RutaProtegida` / `RutaSoloAnonima` (`componentes/Comunes/RutaProtegida.jsx`) ya resuelven el tercer estado "sesión aún no decidida" con `<Cargando enPantallaCompleta />`.
- `componentes/Comunes/` ya contiene `Cargando.jsx` y `MensajeError.jsx` (con `tono` `error` | `aviso`, `role="alert"` | `role="status"`).
- `contexto/ContextoAuth.jsx` expone `usuario`, `cargandoSesion`, `motivoCierre`, `cerrarSesion`, etc. `usuario` trae `nombre` y `email`.
- `paginas/Tareas.jsx` es el destino mínimo actual: dibuja su propia cabecera y su propio botón de cerrar sesión. `fix-estructura-frontend-auth` dejó registrado que esa pantalla se reconstruye desde cero en `add-frontend-tareas` con la estructura correcta (`componentes/Tarea/`).
- Reglas del proyecto que condicionan este diseño: CSS Modules (sin frameworks de utilidades ni styled-components); árbol de carpetas literal del reto (`componentes/<Recurso>/`, `hooks/`, `servicios/`, `contexto/`, `utils/`; sin `paginas/` para piezas nuevas); ninguna dependencia nueva sin justificación escrita.

## Goals / Non-Goals

**Goals:**

- Un único punto donde vive la estructura Header + Sidebar + área de contenido, que las rutas autenticadas consumen sin repetir nada.
- Que añadir una pantalla autenticada en un cambio posterior sea "escribe el componente y añádelo como ruta hija"; nada más.
- Un límite de error que envuelve el árbol y sobrevive a que la ruta cambie.
- Comportamiento responsivo real (panel superpuesto en móvil), no un `@media` que encoge.

**Non-Goals:**

- Reescribir `paginas/Tareas.jsx` para moverla a `componentes/Tarea/` — eso es de `add-frontend-tareas`. Este cambio solo la envuelve en `Layout` allí donde ya está enrutada, y elimina de ella la cabecera y el botón de logout que ahora duplica (pasan al `Header`).
- Enlaces de navegación a categorías y etiquetas: se añaden cuando existan esas rutas.
- Tematización, modo oscuro, animaciones de transición entre rutas.

## Decisions

### 1. El Layout es una ruta de diseño (layout route) con `<Outlet />`, no un wrapper por ruta

`App.jsx` pasa de envolver cada elemento a mano a una ruta padre sin `path` cuyo `element` es `<Layout />`, con las pantallas autenticadas como rutas hijas que se pintan en el `<Outlet />` del Layout:

```
<Route element={<RutaProtegida><Layout /></RutaProtegida>}>
  <Route path="/tareas" element={<Tareas />} />
  {/* categorías, etiquetas… en cambios posteriores */}
</Route>
<Route path="/login"    element={<RutaSoloAnonima><FormularioLogin /></RutaSoloAnonima>} />
<Route path="/registro" element={<RutaSoloAnonima><FormularioRegistro /></RutaSoloAnonima>} />
<Route path="*" element={<Navigate to="/tareas" replace />} />
```

- **Por qué**: con `<Outlet />`, `Header` y `Sidebar` se montan una sola vez y no se vuelven a montar al navegar entre secciones — el requisito "la estructura es la misma entre secciones" sale gratis, y el estado de la navegación (panel abierto/cerrado en móvil) no se pierde al cambiar de pantalla.
- **`RutaProtegida` envuelve `<Layout />`, no cada hija**: la comprobación de sesión y el estado `<Cargando>` ocurren una vez, antes de montar el armazón. Ninguna pantalla hija necesita saber de protección.
- **Alternativa descartada**: `<Layout><Tareas /></Layout>` repetido en cada ruta. Re-monta el armazón en cada navegación, obliga a repetir el wrapper, y multiplica el punto donde se puede olvidar `RutaProtegida`.

### 2. El Error Boundary es un componente de clase propio, colocado en `main.jsx` por dentro del router pero por fuera de `App`

`componentes/Comunes/LimiteDeError.jsx`: componente de clase con `static getDerivedStateFromError` (cambia a estado de error para el render) y `componentDidCatch` (punto único para registrar el error en consola en desarrollo). En estado de error renderiza una pantalla genérica con dos acciones: "Recargar" (`window.location.reload()`) y "Ir al inicio" (`window.location.assign('/')`, que fuerza remonta limpio).

Colocación en `main.jsx`:

```
<BrowserRouter>
  <ProveedorAuth>
    <LimiteDeError>
      <App />
    </LimiteDeError>
  </ProveedorAuth>
</BrowserRouter>
```

- **Por qué dentro del router y del proveedor**: así la pantalla de error puede, si se quiere, usar rutas; y un fallo en `App` o debajo queda cubierto. Se deja fuera de `App` para que el comodín de rutas no compita con el estado de error.
- **Por qué no `react-error-boundary`**: la regla del proyecto prohíbe dependencias nuevas sin justificación, y aquí no hay ninguna: la API de límite de error es intrínsecamente un componente de clase y el envoltorio de la librería no aporta nada que este caso necesite. Queda registrado en `proposal.md`.
- **Limitación asumida**: un Error Boundary no captura errores en manejadores de eventos, código asíncrono ni el propio render de su fallback. Esos casos son los que cubre `MensajeError` (decisión 4).
- **Reset al navegar**: no se añade lógica de reset por cambio de ruta en esta iteración. La vía de recuperación es recargar / ir al inicio. Registrado como aceptable para el alcance del reto; un reset fino puede llegar después sin tocar la spec.

### 3. Responsividad: dos estados discretos gobernados por un `@media` y estado de React para el panel móvil

- Punto de corte único (p. ej. `48rem`) en el `.module.css` del `Layout`. Por encima: `Sidebar` en un `grid` de dos columnas, siempre visible. Por debajo: una sola columna, `Sidebar` fuera del flujo.
- El estado "panel abierto" en móvil es `useState` en `Layout`. `Header` recibe la función para alternarlo y muestra el botón de menú (`aria-expanded`, `aria-controls`). El panel abierto es un `<nav>` superpuesto (position fixed, por encima del contenido) con un backdrop que lo cierra al pulsar fuera; `Esc` también lo cierra.
- Al elegir un destino, `Sidebar` invoca un callback `alNavegar` que el `Layout` usa para cerrar el panel. En escritorio ese callback es innecesario pero inofensivo.
- **Por qué estado de React y no solo CSS (`:target` / checkbox hack)**: hace falta cerrar el panel como efecto de una navegación de React Router, y gestionar foco y `Esc`. El hack de CSS no llega a eso y deja trampas de accesibilidad.
- **Detección de "móvil"**: por CSS, no por `matchMedia` en JS. El estado de React solo controla "abierto/cerrado"; si la ventana se ensancha con el panel abierto, el CSS lo vuelve irrelevante y el `Sidebar` fijo toma el relevo. No se sincroniza el estado con el ancho para no duplicar la fuente de verdad del punto de corte.

### 4. `MensajeError` se conserva tal cual y se le añade la spec que le faltaba

El componente actual ya cumple: `tono` `error` | `aviso`, `role` `alert` | `status`, no renderiza nada sin `children`. Este cambio no lo reescribe; solo formaliza su contrato en `frontend-cascaron/spec.md` para que las pantallas siguientes lo tengan como requisito y no como convención tácita. Si al redactar la spec aparece un hueco (p. ej. falta un `id` estable para `aria-describedby`), se ajusta de forma mínima.

### 5. `Header` y `Sidebar` leen la sesión y la navegación por las vías ya establecidas

- `Header` usa `useAuth()` para `usuario` y `cerrarSesion`. No navega tras cerrar sesión: al vaciarse el estado, `RutaProtegida` deja de dejar pasar y redirige — mismo patrón que ya usa `paginas/Tareas.jsx` hoy.
- `Sidebar` usa `NavLink` de `react-router-dom` para el marcado de "sección activa" (`aria-current="page"` lo da `NavLink`).
- Ni `Header` ni `Sidebar` hacen llamadas a la API, así que no necesitan hook en `hooks/`.

### 6. Ubicación de archivos

```
frontend/src/componentes/Layout/
  Layout.jsx        Layout.module.css
  Header.jsx        Header.module.css
  Sidebar.jsx       Sidebar.module.css
frontend/src/componentes/Comunes/
  LimiteDeError.jsx LimiteDeError.module.css   (nuevo)
  MensajeError.jsx  MensajeError.module.css    (ya existe)
```

Coincide con el árbol del reto (`componentes/Layout/`). No se crea carpeta nueva fuera de las que el árbol contempla.

## Risks / Trade-offs

- **`paginas/Tareas.jsx` queda en una carpeta que el árbol del reto no contempla** → Es deuda ya registrada en `fix-estructura-frontend-auth`; `add-frontend-tareas` la reconstruye en `componentes/Tarea/`. Este cambio no la mueve para no mezclar responsabilidades, pero sí le quita la cabecera y el botón de logout duplicados.
- **El Error Boundary solo se recupera recargando** → Aceptable para el alcance; la spec pide "al menos una vía de recuperación", no un reset transparente. Mejorable después sin cambiar la spec.
- **El botón "Ir al inicio" usa `window.location` y no el router** → Intencionado: si el árbol de React está en estado de error, forzar un arranque limpio del documento es más fiable que confiar en que la navegación de React Router funcione.
- **Un cambio de tamaño de ventana con el panel móvil abierto** → El CSS del punto de corte hace que el `Sidebar` fijo tome el relevo; el estado "abierto" queda inerte hasta que se vuelva a estrechar. Sin parpadeo porque no hay JS reaccionando al `resize`.
- **Punto de corte fijo en `rem`** → Un zoom del navegador o un tamaño de fuente grande mueven el punto de corte en píxeles, que es el comportamiento deseado (se adapta al tamaño real del texto).

## Migration Plan

1. Añadir `LimiteDeError.jsx` + CSS y su pantalla de error.
2. Añadir `Layout.jsx`, `Header.jsx`, `Sidebar.jsx` + CSS.
3. Reescribir `App.jsx` con la ruta de diseño y `<Outlet />`.
4. Envolver `<App />` con `<LimiteDeError>` en `main.jsx`.
5. Quitar de `paginas/Tareas.jsx` la cabecera y el botón de cerrar sesión (ahora los da `Header`); deja solo su contenido.
6. Verificación manual: login → se ve el armazón; navegar; recargar en `/tareas` con sesión; cerrar sesión desde `Header`; forzar un error de render en un componente de prueba y comprobar la pantalla del límite; estrechar la ventana y usar el menú.

Rollback: revertir el commit. No hay estado persistente ni migración de datos; el backend no se toca.

## Open Questions

- El valor exacto del punto de corte y el estilo visual del armazón se afinan en implementación; no afectan a la spec ni al desglose de tareas.
