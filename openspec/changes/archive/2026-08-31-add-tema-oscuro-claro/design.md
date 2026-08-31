## Context

Ver `proposal.md` — Why. Estado actual relevante:

- `frontend/src/estilos/global.css` define todas las variables de color en un único bloque `:root` y `body` las consume (`--color-fondo`, `--color-superficie`, `--color-borde`, `--color-texto`, etc.). Ningún módulo CSS declara colores propios: todos referencian estas variables.
- `frontend/src/main.jsx` monta el árbol como `BrowserRouter > ProveedorAuth > LimiteDeError > App` e importa `global.css`.
- `frontend/src/contexto/ContextoAuth.jsx` ya establece el patrón del proyecto para estado global de cliente con persistencia en `localStorage`: clave constante única, lecturas y escrituras envueltas en `try/catch` (modo privado del navegador), estado inicial calculado una sola vez con inicializador perezoso de `useState`.
- `frontend/src/componentes/Layout/Header.jsx` es un componente funcional dentro de `Layout`, presente en toda pantalla autenticada; consume `useAuth`.
- El `index.html` de Vite tiene el elemento raíz `#raiz`. El documento carga la app como módulo (`type="module"`), es decir de forma diferida respecto al parseo del HTML.

Restricciones del proyecto: React puro con Context API y hooks; CSS Modules; sin dependencias nuevas; árbol de carpetas literal (`contexto/` en singular, `hooks/`).

## Goals / Non-Goals

**Goals:**

- Redefinir el tema con un solo punto de conmutación (un atributo en `<html>`) sin tocar componentes ni módulos CSS existentes salvo `Header`.
- Resolver el tema inicial antes del primer pintado para no mostrar un destello del tema contrario (FOUC).
- Reproducir el patrón de `ContextoAuth` para el estado y la persistencia, por coherencia.

**Non-Goals:**

- Cubrir las pantallas de login y registro con una decisión distinta: heredan el tema como cualquier otra pantalla porque también consumen las variables de `global.css`. El control para alternarlo solo aparece en la cabecera (pantallas autenticadas), lo cual es suficiente.
- Migrar los valores de color actuales a un sistema de tokens con nombres semánticos nuevos: el tema oscuro reutiliza los mismos nombres de variable.
- Transiciones animadas al cambiar de tema.

## Decisions

### Atributo `data-theme` en `document.documentElement`, valores `claro` / `oscuro`

`global.css` se reorganiza así:

- El `:root` actual conserva las variables no cromáticas (espaciado, tipografía, formas) y los colores del tema claro (los valores de hoy) — es el tema por defecto si el atributo faltara.
- Un bloque `:root[data-theme='oscuro'] { ... }` redefine solo las variables de color con la paleta oscura.
- Opcionalmente, para el caso "sin JavaScript todavía": `@media (prefers-color-scheme: dark) { :root:not([data-theme='claro']) { ... } }` con la misma paleta oscura, de modo que si el atributo aún no se ha aplicado, el sistema en oscuro ya ve oscuro. El hook fijará el atributo explícito en cuanto monte.

Alternativa descartada: clase `.tema-oscuro` en `<body>`. El atributo en el nodo raíz es más idiomático para theming, no colisiona con clases de CSS Modules y permite el selector `:root[data-theme=...]`.

Alternativa descartada: dos hojas de estilo alternativas. Multiplica el CSS y complica el cambio instantáneo.

### `ContextoTema.jsx` + `useTema.js`, calcados de `ContextoAuth`

- `contexto/ContextoTema.jsx` exporta `ContextoTema` (creado con `createContext(null)`) y `ProveedorTema`.
- `hooks/useTema.js` exporta `useTema()`, que lee el contexto y lanza si se usa fuera del proveedor (igual que `useAuth`).
- Clave de `localStorage`: `'lista-tareas.tema'` (mismo prefijo que `'lista-tareas.token'`).
- Valores admitidos en `localStorage`: `'claro'` o `'oscuro'`. Cualquier otro valor se trata como ausencia de elección.
- Lecturas/escrituras en helpers con `try/catch` que degradan a "sin elección" / "no persiste".

Estado del proveedor:

- `temaElegido`: `'claro' | 'oscuro' | null` — inicializador perezoso que lee `localStorage`. `null` significa "seguir al sistema".
- `temaSistema`: `'claro' | 'oscuro'` — derivado de `window.matchMedia('(prefers-color-scheme: dark)')`; se suscribe a `change` en un efecto y se da de baja al desmontar.
- `temaActivo` = `temaElegido ?? temaSistema`.

Efecto de layout (`useLayoutEffect`, como en `ContextoAuth` y por el mismo motivo: aplicar antes del pintado): `document.documentElement.setAttribute('data-theme', temaActivo)`.

API expuesta por el contexto (memoizada con `useMemo`):

- `tema`: `temaActivo`.
- `alternarTema()`: fija `temaElegido` al contrario de `temaActivo` y lo persiste. Una vez que hay elección, deja de seguir al sistema (cumple "la elección manual prevalece").
- (No se expone un "volver a seguir el sistema": está fuera de alcance; el control es un simple alternador.)

### Prevención del destello (FOUC)

El script de la app es un módulo diferido, así que `<html>` se pinta una fracción de segundo sin `data-theme`. Mitigaciones, en orden de preferencia:

1. El fallback `@media (prefers-color-scheme: dark)` en `global.css` (arriba) cubre el caso más común —sin elección manual, sistema en oscuro— sin JavaScript.
2. Para el caso "eligió un tema distinto al del sistema", un script inline mínimo y síncrono en `<head>` de `index.html` que lea `localStorage` y fije el atributo antes de que se pinte el body. Es ~5 líneas, sin dependencias. Si se considera que añade ruido al HTML, se acepta el destello breve solo en ese caso minoritario y el script inline queda como mejora opcional documentada en tasks.

Decisión: incluir el script inline. Es la forma estándar de resolver el FOUC de tema y el coste es mínimo.

### `ProveedorTema` en `main.jsx`

Se coloca lo más afuera posible, envolviendo `BrowserRouter` (no depende del router ni de la sesión, y así también cubriría cualquier cosa fuera de rutas):

`ProveedorTema > BrowserRouter > ProveedorAuth > LimiteDeError > App`.

### Control en `Header.jsx`

Un `<button type="button">` en el bloque `estilos.derecha`, junto a `botonSalir`, con `onClick={alternarTema}`. Texto/`aria-label` dinámico: "Cambiar a tema oscuro" / "Cambiar a tema claro" según `tema`. Icono opcional con un `<span aria-hidden>` como el `iconoMenu` existente. Estilos nuevos en `Header.module.css` reutilizando las variables (`--color-borde`, `--radio`, etc.), en línea con `botonMenu` / `botonSalir`.

## Risks / Trade-offs

- **Destello del tema contrario en la carga (FOUC)** → script inline síncrono en `index.html` que aplica `data-theme` desde `localStorage` antes del primer pintado; el fallback `@media` cubre el caso sin elección.
- **Contraste insuficiente en la paleta oscura** → elegir los valores oscuros comprobando contraste AA para texto sobre superficie y para los estados de error/aviso, igual que el comentario ya exige en la paleta clara; verificación manual anotada en tasks.
- **`matchMedia` o su evento `change` no disponibles en entornos muy antiguos** → `temaSistema` degrada a `'claro'` si `window.matchMedia` no existe; la suscripción se hace solo si la API está presente.
- **Módulos CSS que hubieran fijado colores literales** → se revisa en tasks que ningún `.module.css` declare colores fuera de las variables; hoy no lo hacen, pero conviene confirmarlo para que el tema oscuro sea completo.
- **Doble fuente de verdad entre el script inline y el proveedor** → el script inline solo *aplica* el atributo; el proveedor lo vuelve a fijar en su `useLayoutEffect` con la misma lógica (`localStorage` → sistema). Ambos leen la misma clave y las mismas reglas; el proveedor manda en cuanto monta.
