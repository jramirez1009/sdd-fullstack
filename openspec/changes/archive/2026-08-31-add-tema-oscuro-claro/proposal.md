## Why

El alcance obligatorio del reto está completo y toca abordar las mejoras bonus. Alternar entre tema claro y oscuro es la de menor esfuerzo y mayor impacto visual: los colores de la aplicación ya viven centralizados como variables CSS en `global.css`, así que ofrecer un tema oscuro no exige reescribir componentes, solo redefinir esas variables cuando el tema activo lo pida.

## What Changes

- **Set de variables de color por tema en `global.css`**: el bloque `:root` actual pasa a ser el tema "claro"; se añade un bloque hermano que redefine las mismas variables de color para el tema "oscuro". Solo cambian valores de color; el espaciado, la tipografía y las formas quedan igual.
- **Atributo de tema en el elemento raíz del documento**: el tema activo se expresa con un atributo (`data-theme="claro"` / `data-theme="oscuro"`) en `<html>`. El CSS selecciona el set de variables a partir de ese atributo.
- **Contexto y hook de tema propios de React**: un `ContextoTema` en `contexto/` con su hook en `hooks/` resuelve el tema inicial (preferencia del sistema operativo vía `prefers-color-scheme`, salvo que exista una elección previa en `localStorage`), aplica el atributo al documento, expone el tema actual y la acción de alternarlo, y persiste toda elección manual en `localStorage`.
- **Control de tema en la cabecera**: `Header.jsx` gana un botón para alternar el tema, visible en todas las pantallas autenticadas (la cabecera vive dentro de `Layout`). El cambio es instantáneo, sin recarga, y afecta a toda la aplicación a la vez.
- **El proveedor de tema envuelve el árbol de la aplicación** en `main.jsx`, junto al resto de proveedores.

Sin cambios de ruptura: el backend no se toca; ninguna URL ni contrato de API cambia; el tema por defecto (seguir la preferencia del sistema) reproduce el aspecto actual en la mayoría de equipos.

## Capabilities

### New Capabilities

- `frontend-tema`: la preferencia de tema visual (claro / oscuro) de la aplicación autenticada —cómo se determina el tema inicial, cómo la persona lo alterna desde la cabecera, cómo se aplica de forma instantánea y global, y cómo se recuerda entre visitas.

### Modified Capabilities

Ninguna. La capability `frontend-cascaron` describe la cabecera del armazón (identidad y cierre de sesión) y su navegación; que la cabecera incorpore además un control de tema es una capacidad nueva y separada, no una modificación de los requisitos existentes de `frontend-cascaron`.

## Impact

- **Código nuevo**: `frontend/src/contexto/ContextoTema.jsx` (proveedor + contexto), `frontend/src/hooks/useTema.js` (hook de consumo).
- **Código modificado**: `frontend/src/estilos/global.css` (bloque de tema oscuro y organización de las variables de color por tema), `frontend/src/main.jsx` (el proveedor de tema envuelve el árbol), `frontend/src/componentes/Layout/Header.jsx` y `Header.module.css` (botón para alternar el tema).
- **Dependencias nuevas**: ninguna. Se resuelve con CSS Modules, variables CSS y Context API / hooks de React puro.
- **Almacenamiento**: una clave nueva en `localStorage` del navegador para la elección manual de tema. No se persiste en el backend ni en la base de datos: no es un dato de usuario.
- **Sin impacto**: backend, base de datos, contrato de la API, variables de entorno, autenticación y el resto de pantallas de contenido (heredan el tema por las variables CSS sin cambios propios).

## Decisiones registradas

- **2026-08-31 — El tema por defecto sigue la preferencia del sistema operativo (`prefers-color-scheme`).** Es lo que la persona ya espera de su equipo y evita imponer un aspecto. La elección manual solo entra en juego cuando la persona la hace explícitamente.
- **2026-08-31 — Una elección manual de tema se guarda en `localStorage` y prevalece sobre la preferencia del sistema en visitas futuras.** Si alguien fuerza el tema oscuro con el sistema en claro, esa decisión debe sobrevivir a la recarga. La preferencia del sistema se sigue consultando solo mientras no haya elección guardada.
- **2026-08-31 — El tema se controla con un atributo `data-theme` en `<html>`, no con una clase ni con hojas de estilo alternativas.** Un único atributo en el nodo raíz permite que un solo bloque CSS redefina las variables y que todo el árbol reaccione a la vez, sin tocar componentes.
- **2026-08-31 — El control de tema vive en `Header.jsx`.** La cabecera es el único punto visible en todas las pantallas autenticadas (está dentro de `Layout`); es el sitio natural para una preferencia global de interfaz, junto a la identidad y el cierre de sesión.
- **2026-08-31 — La preferencia de tema no se sincroniza con el backend.** Es una preferencia del navegador, no un atributo de la cuenta; añadir una columna y un endpoint para ella excede el valor de una mejora bonus y contradice su objetivo de mínimo esfuerzo.
- **2026-08-31 — Fuera de alcance**: temas adicionales más allá de claro y oscuro; temas personalizables por la persona (elegir sus propios colores); sincronizar la preferencia de tema con el backend o la base de datos; y animar la transición entre temas más allá de lo que aporten las transiciones CSS ya existentes.
