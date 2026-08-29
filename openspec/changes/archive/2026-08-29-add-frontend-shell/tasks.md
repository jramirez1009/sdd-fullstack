## 1. Límite de error

- [x] 1.1 Crear `frontend/src/componentes/Comunes/LimiteDeError.jsx` como componente de clase con `getDerivedStateFromError` y `componentDidCatch` (registro en consola solo en desarrollo); en estado de error renderiza una pantalla genérica con acciones "Recargar" y "Ir al inicio", sin traza de pila. Verificar: forzar un `throw` en un componente de prueba montado bajo el límite y comprobar que aparece la pantalla genérica en vez de una pantalla en blanco y que la consola no muestra detalles al usuario final.
- [x] 1.2 Crear `frontend/src/componentes/Comunes/LimiteDeError.module.css` con el estilo de la pantalla de error (CSS Modules). Verificar: la pantalla de error se ve centrada y legible en ventana ancha y estrecha.
- [x] 1.3 En `frontend/src/main.jsx`, envolver `<App />` con `<LimiteDeError>` por dentro de `BrowserRouter` y `ProveedorAuth`. Verificar: un error de render en cualquier ruta muestra la pantalla del límite; "Ir al inicio" recarga en `/` y "Recargar" reinicia la app.

## 2. Componentes del armazón

- [x] 2.1 Crear `frontend/src/componentes/Layout/Header.jsx`: usa `useAuth()` para mostrar `usuario.nombre ?? usuario.email` y un botón de cerrar sesión que llama a `cerrarSesion()` sin navegar a mano; en pantalla estrecha muestra el botón de menú con `aria-expanded` y `aria-controls` apuntando al panel de navegación. Verificar: la cabecera identifica a la persona autenticada y el botón de logout lleva a `/login`.
- [x] 2.2 Crear `frontend/src/componentes/Layout/Sidebar.jsx`: navegación con `NavLink` a las secciones existentes (hoy solo `/tareas`), marca de sección activa vía `NavLink`/`aria-current`, y callback `alNavegar` que se invoca al elegir un destino. Verificar: al pulsar un enlace se navega y el enlace activo queda marcado; no hay enlaces a categorías/etiquetas.
- [x] 2.3 Crear `frontend/src/componentes/Layout/Layout.jsx`: compone `Header` + `Sidebar` + `<Outlet />`; mantiene el estado `panelAbierto` (móvil), lo pasa a `Header` (alternar) y a `Sidebar` (cerrar al navegar), cierra el panel con `Esc` y con clic en el backdrop. Verificar: navegar entre rutas hijas no re-monta `Header`/`Sidebar` (p. ej. un contador local en `Header` no se reinicia).
- [x] 2.4 Crear `Layout.module.css`, `Header.module.css`, `Sidebar.module.css` con un único punto de corte (~`48rem`): grid de dos columnas con sidebar fijo por encima; una columna con panel superpuesto + backdrop por debajo; contenido sin desplazamiento horizontal. Verificar: en ventana ancha el sidebar se ve siempre; en estrecha se oculta tras el botón de menú y se superpone al abrirlo.

## 3. Integración de rutas

- [x] 3.1 Reescribir `frontend/src/App.jsx`: ruta de diseño `element={<RutaProtegida><Layout /></RutaProtegida>}` con `/tareas` como ruta hija en el `<Outlet />`; mantener `/login` y `/registro` con `RutaSoloAnonima` fuera del Layout; conservar `<Route path="*" element={<Navigate to="/tareas" replace />} />`. Verificar: `/tareas` con sesión muestra el armazón; `/login` y `/registro` se muestran a pantalla completa sin cabecera ni navegación.
- [x] 3.2 Quitar de `frontend/src/paginas/Tareas.jsx` la cabecera propia y el botón de cerrar sesión (ahora los aporta `Header`), dejando solo el contenido de la pantalla. Verificar: no hay dos cabeceras ni dos botones de logout en `/tareas`.
- [x] 3.3 Comprobar la restauración de sesión: recargar en `/tareas` con token válido mantiene a la persona en `/tareas` dentro del armazón, mostrando `<Cargando enPantallaCompleta />` mientras `RutaProtegida` decide. Verificar: no hay parpadeo a `/login` ni a una pantalla sin armazón.

## 4. Componente común de errores de negocio

- [x] 4.1 Revisar `frontend/src/componentes/Comunes/MensajeError.jsx` contra el requisito "Componente común para los errores de negocio previsibles" de `frontend-cascaron/spec.md`; ajustar solo si falta algo (p. ej. un `id` estable para `aria-describedby`). Verificar: sin `children` no renderiza nada; con `tono="aviso"` usa `role="status"`; con `tono="error"` usa `role="alert"`.

## 5. Verificación integral

- [x] 5.1 Recorrido manual completo: registro → armazón visible; navegación entre secciones sin remonte; recarga con sesión; cierre de sesión desde `Header` → `/login`; error de render forzado → pantalla del límite con recuperación; ventana estrecha → menú hamburguesa abre/cierra el panel y navegar lo cierra; contenido sin scroll horizontal. Verificar: todos los escenarios de `openspec/changes/add-frontend-shell/specs/frontend-cascaron/spec.md` se observan.
- [x] 5.2 Ejecutar `npm run build` en `frontend/` y `openspec validate add-frontend-shell --strict`. Verificar: build sin errores y validación sin fallos.
