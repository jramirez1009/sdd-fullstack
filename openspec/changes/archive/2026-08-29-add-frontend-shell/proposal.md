## Why

Con el registro y el inicio de sesión ya funcionando, la aplicación sabe quién es la persona pero todavía no tiene dónde ponerla: cada pantalla autenticada que llegue después (tareas, categorías, etiquetas) necesita una estructura visual común —cabecera con la identidad y el cierre de sesión, navegación lateral— y una red de seguridad que impida que el fallo de render de un componente deje la pantalla en blanco. Ese armazón se construye ahora, una sola vez, para que los tres cambios de contenido siguientes se limiten a rellenar el área principal sin volver a resolver la cabecera, la navegación, el comportamiento responsivo ni el manejo de errores inesperados.

## What Changes

- **Capa de Layout para las pantallas autenticadas**: `Layout.jsx` compone `Header.jsx` (identidad de la persona autenticada y acción de cierre de sesión) y `Sidebar.jsx` (navegación entre las secciones de la aplicación) alrededor de un área de contenido donde cada pantalla de negocio se renderiza. Las pantallas de inicio de sesión y de registro NO usan este Layout: se muestran solas, a pantalla completa.
- **Error Boundary sobre el árbol principal**: al menos un límite de error envuelve la aplicación. Si un componente lanza un error durante el render, se muestra una pantalla de error genérica y amigable en lugar de una pantalla en blanco o el error crudo de React, y se ofrece una vía de recuperación (recargar / volver al inicio).
- **`MensajeError.jsx` como componente común de errores de negocio**: se formaliza el componente reutilizable —ya presente en el código desde el trabajo de autenticación— para mostrar errores esperables de la aplicación (credenciales inválidas, un recurso que no carga, una validación del servidor). Es distinto del Error Boundary: el Boundary cubre fallos de render inesperados; `MensajeError` cubre fallos previstos que la aplicación sabe nombrar.
- **Layout responsivo**: en pantallas anchas el Sidebar es visible de forma permanente junto al contenido; en pantallas estrechas se oculta tras un control accesible (botón de menú / hamburguesa) que lo despliega como panel superpuesto y lo cierra al elegir un destino o al pulsar fuera. No se muestra una versión encogida e ilegible del layout de escritorio.
- **Integración con las rutas ya existentes**: la ruta `/tareas` (y las secciones autenticadas que añadan los cambios siguientes) pasa a renderizarse dentro de `Layout`. El guardián `RutaProtegida` y la redirección de personas ya autenticadas fuera de `/login` y `/registro` ya existen y no se tocan: este cambio los consume tal cual.

Sin cambios de ruptura: el backend no se toca; ninguna URL cambia; el comportamiento observable de autenticación es idéntico.

## Capabilities

### New Capabilities

- `frontend-cascaron`: el armazón visual y de resiliencia de la aplicación autenticada —la estructura común de Layout (cabecera con identidad y cierre de sesión, navegación lateral, área de contenido), su comportamiento responsivo, el límite de error que evita que un fallo de render tumbe toda la interfaz, y el componente común para mostrar errores de negocio previsibles.

### Modified Capabilities

Ninguna. La capability `frontend-autenticacion` ya describe la protección de rutas, la redirección de personas autenticadas fuera de las pantallas de sesión y la exigencia de sesión para las pantallas protegidas; este cambio las consume sin alterar ningún requisito. Que el contenido protegido se renderice dentro de `Layout` es un detalle de implementación, no un cambio de comportamiento especificado.

## Impact

- **Código nuevo**: `frontend/src/componentes/Layout/Layout.jsx`, `Header.jsx`, `Sidebar.jsx` con sus `.module.css`; `frontend/src/componentes/Comunes/LimiteDeError.jsx` (Error Boundary) con su `.module.css` y su pantalla de error genérica.
- **Código modificado**: `frontend/src/App.jsx` (las rutas autenticadas se anidan bajo `Layout`); `frontend/src/main.jsx` (el Error Boundary envuelve el árbol principal); `frontend/src/componentes/Comunes/MensajeError.jsx` solo si la formalización de su contrato exige ajustarlo (hoy ya existe y es funcional).
- **Dependencias nuevas**: ninguna. `react-router-dom` ya es dependencia del frontend desde `add-frontend-autenticacion`; el Error Boundary se implementa con React puro (componente de clase con `componentDidCatch` / `getDerivedStateFromError`), sin librerías.
- **Especificaciones**: nueva `openspec/specs/frontend-cascaron/spec.md`.
- **Sin impacto**: backend, base de datos, contrato de la API, variables de entorno, y el comportamiento de registro / inicio de sesión / persistencia de sesión.
- **Cambios posteriores habilitados**: `add-frontend-tareas`, y los de categorías y etiquetas, pueden escribir su pantalla como el contenido que va dentro de `Layout`, sin resolver cabecera, navegación ni responsividad.

## Decisiones registradas

- **2026-08-29 — El armazón entra como un cambio propio, antes de cualquier pantalla de contenido.** Header, Sidebar, Layout, el comportamiento responsivo y el límite de error son transversales a las tres pantallas de negocio que vienen después. Resolverlos una vez aquí evita que el primer cambio de contenido cargue con ellos y que los siguientes los copien o los diverjan.
- **2026-08-29 — El Error Boundary se implementa con React puro, no con una dependencia.** React solo ofrece la API de límite de error a través de un componente de clase; una librería (`react-error-boundary`) es azúcar sobre eso. La regla del proyecto prohíbe dependencias nuevas sin justificación escrita, y aquí no hay ninguna que dé: un componente de clase de treinta líneas cubre el requisito.
- **2026-08-29 — La protección de rutas y las redirecciones de sesión no se reescriben ni se mueven de capability.** `frontend-autenticacion` ya las especifica y `RutaProtegida` / `RutaSoloAnonima` ya las implementan. Este cambio solo hace que el contenido protegido se renderice dentro de `Layout`; duplicar esos requisitos en `frontend-cascaron` crearía dos fuentes de verdad para la misma regla.
- **2026-08-29 — `MensajeError` se formaliza en esta capability aunque el archivo ya exista.** Se creó durante el trabajo de autenticación sin un requisito que fijara su contrato. Como es la pieza común de errores de negocio para todas las pantallas siguientes, su comportamiento (qué muestra, cómo se anuncia a un lector de pantalla, en qué se diferencia del Error Boundary) se especifica aquí.
- **2026-08-29 — En móvil el Sidebar se oculta tras un control accesible y se superpone al desplegarse; no se reserva una franja lateral encogida.** Una versión reducida del Sidebar de escritorio queda ilegible y roba ancho al contenido, que es lo escaso en móvil. El patrón de panel superpuesto con botón de menú es el que el reto describe como aceptable.
- **2026-08-29 — El Sidebar enlaza solo a los destinos que existen.** Hoy solo `/tareas` es una pantalla real; los enlaces a categorías y etiquetas se añaden en sus respectivos cambios, cuando esas rutas existan, para no ofrecer navegación a una pantalla en blanco.
- **2026-08-29 — Fuera de alcance en este cambio**: las pantallas de contenido (tareas, categorías, etiquetas); cualquier cambio en la lógica de negocio de autenticación; animaciones o transiciones entre rutas; soporte offline o service workers; y el diseño visual definitivo más allá de que sea funcional, responsivo y accesible con CSS Modules.
