## Why

La implementación de `add-frontend-autenticacion` generó los formularios de sesión como
`src/paginas/Login.jsx` y `src/paginas/Registro.jsx`, y el estado de sesión bajo
`src/contextos/` (plural). El árbol de carpetas del reto técnico los nombra de otra forma:
`componentes/Auth/FormularioLogin.jsx`, `componentes/Auth/FormularioRegistro.jsx` y
`contexto/` (singular). El reto evalúa explícitamente "estructura y reutilización de
componentes" dentro del criterio de Implementación del Frontend y muestra un árbol de
referencia concreto, así que esta desviación se corrige antes de construir encima
(categorías, tareas, layout), sobre todo porque el mismo patrón ya reapareció en
`paginas/Tareas.jsx`.

La `spec.md` de `frontend-autenticacion` describió el comportamiento (registro, inicio de
sesión, persistencia) pero no fijó los nombres ni las ubicaciones de archivo. Por el
principio de que la spec es la fuente de verdad, esa omisión se regulariza aquí: se añade
un requisito de estructura de archivos y se deja fijado en el proyecto que toda pieza
futura de frontend siga el árbol del reto de forma literal.

Decisión registrada (2026-08-29): la corrección es puramente estructural. No cambia ningún
comportamiento observable de autenticación.

## What Changes

- Los formularios de autenticación pasan de `src/paginas/Login.jsx` y
  `src/paginas/Registro.jsx` a `src/componentes/Auth/FormularioLogin.jsx` y
  `src/componentes/Auth/FormularioRegistro.jsx`, como componentes reutilizables sin lógica
  de ruteo mezclada. Sus `.module.css` se mueven al lado con el nuevo nombre.
- La carpeta `src/contextos/` (plural) se renombra a `src/contexto/` (singular); su
  contenido (`ContextoAuth.jsx`) no cambia salvo la ruta.
- `App.jsx` enruta directamente a `FormularioLogin` y `FormularioRegistro`, sin una capa
  intermedia de "página".
- La carpeta `src/paginas/` deja de usarse para autenticación y se elimina si queda vacía
  (nota: `paginas/Tareas.jsx` sigue ahí y **no** se toca en este cambio).
- Se actualizan todos los imports afectados (`main.jsx`, `hooks/useAuth.js`,
  `App.jsx`, los propios formularios).
- Se añade a `openspec/config.yaml` una regla de artefacto `design` que obliga a que toda
  pieza futura de frontend siga el árbol del reto de forma literal
  (`componentes/<Recurso>/`, `hooks/`, `servicios/`, `contexto/`, `utils/`).
- **Modificación de spec**: `frontend-autenticacion` gana un requisito nuevo que fija la
  estructura y ubicación de archivos de la interfaz de autenticación. No se altera ningún
  requisito de comportamiento existente.

No hay cambios BREAKING: ninguna URL, ningún contrato de API ni ningún comportamiento
observable cambia.

## Capabilities

### New Capabilities

<!-- Ninguna. -->

### Modified Capabilities

- `frontend-autenticacion`: se añade un requisito de estructura de archivos de la interfaz
  de autenticación (ubicación y nombre de los formularios y del contexto de sesión),
  alineado con el árbol de carpetas del reto técnico. Ningún requisito de comportamiento
  cambia.

## Impact

- **Código de frontend** (movimientos y renombrados, sin cambio de lógica):
  - `src/paginas/Login.jsx` → `src/componentes/Auth/FormularioLogin.jsx`
  - `src/paginas/Login.module.css` → `src/componentes/Auth/FormularioLogin.module.css`
  - `src/paginas/Registro.jsx` → `src/componentes/Auth/FormularioRegistro.jsx`
  - `src/paginas/Registro.module.css` → `src/componentes/Auth/FormularioRegistro.module.css`
  - `src/contextos/ContextoAuth.jsx` → `src/contexto/ContextoAuth.jsx`
  - Imports en `src/App.jsx`, `src/main.jsx`, `src/hooks/useAuth.js`
- **Especificaciones**: `openspec/specs/frontend-autenticacion/spec.md` (nuevo requisito).
- **Configuración**: `openspec/config.yaml` (nueva regla de `design`).
- **Sin impacto**: backend, base de datos, `paginas/Tareas.jsx`, rutas, dependencias,
  variables de entorno, comportamiento de login/registro/sesión.

## Out of Scope

- Cualquier corrección sobre `paginas/Tareas.jsx` (se resuelve en `add-frontend-tareas`,
  que reconstruye esa pantalla desde cero con la estructura correcta).
- Cualquier cambio de comportamiento de autenticación.
- Layout, Error Boundaries y rutas protegidas más allá de ajustar sus imports
  (cubiertos en `add-frontend-shell`).
