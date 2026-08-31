## 1. Variables de color por tema en global.css

- [x] 1.1 En `frontend/src/estilos/global.css`, separar en el bloque `:root` las variables de color (tema claro, valores actuales) del resto (espaciado, tipografía, formas), dejando el comportamiento visual actual intacto; verificar arrancando `npm run dev` que la aplicación se ve exactamente igual que antes.
- [x] 1.2 Añadir el bloque `:root[data-theme='oscuro']` que redefine únicamente las variables de color con una paleta oscura, comprobando contraste AA para `--color-texto` y `--color-texto-suave` sobre `--color-superficie` y `--color-fondo`, y para `--color-error` / `--color-aviso` sobre sus fondos; verificar fijando a mano `document.documentElement.dataset.theme = 'oscuro'` en la consola del navegador que toda la interfaz cambia a oscuro sin zonas claras residuales.
- [x] 1.3 Añadir el fallback `@media (prefers-color-scheme: dark) { :root:not([data-theme='claro']) { ... } }` con la misma paleta oscura; verificar que, sin atributo `data-theme` y con el sistema en modo oscuro, la aplicación carga ya en oscuro.
- [x] 1.4 Revisar que ningún `*.module.css` de `frontend/src` declare valores de color literales fuera de las variables (`grep` de `#`, `rgb(`, `hsl(` en los módulos); si aparece alguno, sustituirlo por la variable correspondiente y anotarlo. Verificar que el tema oscuro no deja ningún elemento con color fijo del tema claro.

## 2. Contexto y hook de tema

- [x] 2.1 Crear `frontend/src/contexto/ContextoTema.jsx` con `ContextoTema = createContext(null)` y `ProveedorTema`: helpers `leerTemaGuardado` / `guardarTema` / `borrarTema` sobre la clave `'lista-tareas.tema'` con `try/catch` (patrón de `ContextoAuth.jsx`), aceptando solo `'claro'` / `'oscuro'`. Verificar con un render de prueba que el proveedor monta sin errores.
- [x] 2.2 En `ProveedorTema`, calcular `temaElegido` con inicializador perezoso de `useState` desde `localStorage`; derivar `temaSistema` de `window.matchMedia('(prefers-color-scheme: dark)')` (degradar a `'claro'` si `matchMedia` no existe) y suscribirse a su evento `change` en un `useEffect` con baja al desmontar. Verificar que cambiar la preferencia del SO, sin elección guardada, actualiza `temaSistema`.
- [x] 2.3 Aplicar `temaActivo = temaElegido ?? temaSistema` al documento con `useLayoutEffect` (`document.documentElement.setAttribute('data-theme', temaActivo)`). Exponer vía `useMemo` `{ tema, alternarTema }`, donde `alternarTema()` fija `temaElegido` al contrario de `temaActivo` y lo persiste. Verificar en el navegador que el atributo `data-theme` de `<html>` refleja el tema activo en todo momento.
- [x] 2.4 Crear `frontend/src/hooks/useTema.js` que exporte `useTema()`, leyendo `ContextoTema` y lanzando un error si se usa fuera de `ProveedorTema` (patrón de `useAuth.js`). Verificar que un componente que lo usa fuera del proveedor lanza el error esperado.

## 3. Integración en el árbol de la aplicación

- [x] 3.1 En `frontend/src/main.jsx`, envolver el árbol con `<ProveedorTema>` como proveedor más externo (`ProveedorTema > BrowserRouter > ProveedorAuth > LimiteDeError > App`). Verificar que la aplicación arranca y que el tema por defecto sigue la preferencia del sistema.
- [x] 3.2 Añadir en el `<head>` de `frontend/index.html` un script inline síncrono mínimo que lea `'lista-tareas.tema'` de `localStorage` (con `try/catch`) y, si es `'claro'` u `'oscuro'`, fije `document.documentElement.setAttribute('data-theme', ...)` antes del primer pintado. Verificar que, con una elección manual contraria a la del sistema guardada, la página carga sin destello del tema del sistema.

## 4. Control de tema en la cabecera

- [x] 4.1 En `frontend/src/componentes/Layout/Header.jsx`, consumir `useTema()` y añadir en el bloque `estilos.derecha` un `<button type="button">` que llame a `alternarTema`, con `aria-label` dinámico ("Cambiar a tema oscuro" / "Cambiar a tema claro") según `tema` y un indicador visible del tema (texto y/o icono `aria-hidden`). Verificar con teclado y con un lector de pantalla que el control se enfoca, se activa y anuncia su acción.
- [x] 4.2 Añadir en `frontend/src/componentes/Layout/Header.module.css` los estilos del botón de tema, reutilizando las variables (`--color-borde`, `--radio`, `--espacio-*`) y alineados con `botonMenu` / `botonSalir`. Verificar que el botón se ve correcto en ambos temas y en pantalla estrecha y ancha.
- [x] 4.3 Verificar el flujo completo: activar el control cambia toda la interfaz al instante sin recarga; recargar conserva el tema elegido; con una elección guardada, cambiar la preferencia del SO no altera el tema; y con `localStorage` bloqueado la aplicación sigue permitiendo alternar el tema durante la sesión.

## 5. Validación

- [x] 5.1 Ejecutar `openspec validate add-tema-oscuro-claro --strict` y corregir cualquier hallazgo.
- [x] 5.2 Ejecutar el linter del frontend y dejar el árbol sin advertencias nuevas. Nota: `frontend/package.json` no define script `lint`; se usó `npm run build` (Vite) como sustituto y compila sin errores ni advertencias.
