## 1. Mover el contexto de sesión a `contexto/` (singular)

- [x] 1.1 `git mv frontend/src/contextos/ContextoAuth.jsx frontend/src/contexto/ContextoAuth.jsx` y eliminar la carpeta `frontend/src/contextos/` si queda vacía; verificar que `frontend/src/contextos/` ya no existe y que `frontend/src/contexto/ContextoAuth.jsx` sí
- [x] 1.2 Actualizar el import en `frontend/src/main.jsx` (`./contextos/ContextoAuth.jsx` → `./contexto/ContextoAuth.jsx`) y en `frontend/src/hooks/useAuth.js` (`../contextos/ContextoAuth.jsx` → `../contexto/ContextoAuth.jsx`); verificar con una búsqueda de `contextos/` en `frontend/src` que no quedan referencias

## 2. Mover los formularios a `componentes/Auth/`

- [x] 2.1 `git mv` de `frontend/src/paginas/Login.jsx` → `frontend/src/componentes/Auth/FormularioLogin.jsx` y `frontend/src/paginas/Login.module.css` → `frontend/src/componentes/Auth/FormularioLogin.module.css`; verificar que ambos archivos existen en la nueva ruta
- [x] 2.2 `git mv` de `frontend/src/paginas/Registro.jsx` → `frontend/src/componentes/Auth/FormularioRegistro.jsx` y `frontend/src/paginas/Registro.module.css` → `frontend/src/componentes/Auth/FormularioRegistro.module.css`; verificar que ambos archivos existen en la nueva ruta
- [x] 2.3 En `FormularioLogin.jsx`: renombrar `export function Login` → `export function FormularioLogin`; reescribir imports a la nueva profundidad (`../componentes/Comunes/…` → `../Comunes/…`; `../contextos/ContextoAuth.jsx` → `../../contexto/ContextoAuth.jsx`; `../hooks/…` → `../../hooks/…`; `../servicios/…` → `../../servicios/…`; `./Login.module.css` → `./FormularioLogin.module.css`); verificar que no queda ningún import con una sola `../` hacia `hooks`, `servicios`, `contexto` o `componentes`
- [x] 2.4 En `FormularioRegistro.jsx`: renombrar `export function Registro` → `export function FormularioRegistro` y reescribir imports de forma equivalente, incluido `./Registro.module.css` → `./FormularioRegistro.module.css`; verificar como en 2.3
- [x] 2.5 Confirmar que `frontend/src/paginas/` ya no contiene archivos de autenticación (solo `Tareas.jsx` / `Tareas.module.css`, que no se tocan)

## 3. Enrutar directamente a los componentes

- [x] 3.1 En `frontend/src/App.jsx`: cambiar los imports a `./componentes/Auth/FormularioLogin.jsx` y `./componentes/Auth/FormularioRegistro.jsx`, y sustituir `<Login />`/`<Registro />` por `<FormularioLogin />`/`<FormularioRegistro />` dentro de `RutaSoloAnonima`; verificar que no queda ninguna referencia a `paginas/Login` ni `paginas/Registro` en `App.jsx`

## 4. Fijar la regla anti-recurrencia

- [x] 4.1 Añadir a `openspec/config.yaml`, bajo `rules.design`, una entrada que obligue a que todo `design.md` de frontend declare la ubicación de cada pieza según el árbol del reto de forma literal (`componentes/<Recurso>/`, `hooks/`, `servicios/`, `contexto/`, `utils/`); verificar que `openspec validate fix-estructura-frontend-auth` sigue pasando y que el YAML es válido

## 5. Verificación integral

- [x] 5.1 Ejecutar `npm run build` en `frontend/` y verificar que termina sin errores de resolución de módulos
- [x] 5.2 Con el backend en el puerto 3000 y `npm run dev`, recorrer manualmente: registro de una cuenta nueva, cierre de sesión, inicio de sesión, inicio de sesión con credenciales incorrectas (mensaje único), recarga de página con sesión activa (permanece autenticado). Verificar que el token sigue guardándose en `localStorage` y que el comportamiento es idéntico al previo al cambio
- [x] 5.3 Ejecutar `openspec validate fix-estructura-frontend-auth --strict` y verificar que pasa
