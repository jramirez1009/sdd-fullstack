## Context

Ver `proposal.md` — Why para la motivación, y `specs/frontend-autenticacion/spec.md` para el contrato de comportamiento. Aquí solo lo que condiciona el enfoque técnico.

Lo que ya existe y este cambio consume sin discutir:

- La API expone `POST /api/auth/registro` (responde `201` con `{ id, email, nombre }`, **sin token**), `POST /api/auth/login` (responde `200` con `{ token, usuario }`) y `GET /api/auth/perfil` (protegido, responde `200` con los datos públicos del usuario).
- Todo error de la API llega con la misma forma: estado HTTP más un cuerpo con un **código estable** (`DATOS_INVALIDOS`, `EMAIL_DUPLICADO`, `CREDENCIALES_INVALIDAS`, `NO_AUTENTICADO`, `DEMASIADAS_PETICIONES`, `ERROR_INTERNO`, …) y un mensaje ya redactado en español. El código existe precisamente para que el cliente decida por él y nunca por el texto.
- `DATOS_INVALIDOS` viaja además con `detalles`, un objeto de campo a motivo (`{ email: "…", password: "…" }`), que encaja directamente con los errores por campo de un formulario.
- La contraseña se valida en el backend entre 8 y 72 **bytes** en UTF-8; el límite superior lo impone bcrypt.
- El backend corre en el puerto 3000 y ya tiene CORS activo sin restricción de origen, así que la SPA servida por Vite lo alcanza sin ningún ajuste de backend. También hay rate limiting: un `429` es una respuesta posible de cualquier llamada.

La restricción que domina el diseño: la aplicación tiene **tres** estados de sesión, no dos —autenticada, no autenticada y *todavía no se sabe*—, y casi todo lo que puede salir mal en este cambio sale de tratar el tercero como si fuera el segundo.

## Goals / Non-Goals

**Goals:**

- Un único punto que sepa que existe un token: el servicio de API lo adjunta, el contexto lo posee, nadie más lo toca.
- Un único punto que reaccione al `401`, para que ninguna pantalla futura pueda olvidarse de manejarlo.
- Que el estado "restaurando sesión" sea explícito en el modelo, no un efecto colateral de que el estado inicial esté vacío.
- Dejar el transporte y la protección de rutas listos para que los cambios de frontend siguientes solo añadan pantallas.
- Estructura de carpetas coherente con la del enunciado, para que el evaluador encuentre lo que espera donde lo espera.

**Non-Goals:**

- Una librería de estado de servidor (React Query, SWR) ni un gestor de estado global (Redux, Zustand): el enunciado fija Context API y este cambio maneja un único recurso.
- Refrescar el token, renovarlo antes de que caduque o avisar de que está a punto de caducar.
- Internacionalización: los mensajes vienen en español desde la API y los del cliente se escriben en español.
- Tests automatizados de interfaz. La verificación de este cambio es manual y está enumerada en `tasks.md`.

## Decisions

### 1. Dependencia nueva: `react-router-dom`

**Justificación escrita, según exige la regla del proyecto de no añadir dependencias sin ella.**

El comportamiento especificado incluye "acceso directo a la dirección de una pantalla protegida", "una persona autenticada que solicita `/login` va a `/tareas`" y "dirección desconocida". Todo eso presupone que cada pantalla tiene una URL. Resolverlo con renderizado condicional en `App.jsx` obligaría a escribir a mano lo que el router ya resuelve: sincronizar con `history.pushState`, escuchar `popstate` para que el botón de atrás funcione, y leer la ruta inicial al arrancar. Sería una reimplementación peor de una pieza estándar, y crecería con cada pantalla que añadan los tres cambios siguientes.

`react-router-dom` es la librería de rutas de facto de React, no arrastra dependencias transitivas de peso, no es un meta-framework —el proyecto sigue siendo una SPA de React con Vite, como fija el enunciado— y su modo `BrowserRouter` no necesita nada del servidor durante el desarrollo porque Vite ya sirve `index.html` para cualquier ruta.

**Alternativas descartadas**: renderizado condicional (arriba); `wouter` (más pequeño, pero ahorrar unos kilobytes no compensa apartarse de lo que un evaluador espera ver); enrutado por hash (funciona sin configuración de servidor, pero produce URLs con `#` que ni se comparten bien ni aportan nada aquí).

El resto de dependencias no necesita justificación: `react`, `react-dom`, `vite` y `@vitejs/plugin-react` son el stack que el enunciado fija.

### 2. El modelo de sesión tiene un estado "no se sabe todavía"

`ContextoAuth` mantiene `{ usuario, token, cargandoSesion }`, donde `cargandoSesion` empieza en `true` **solo si hay un token en `localStorage`**, y en `false` si no lo hay. Sin token guardado no hay nada que restaurar y no tiene sentido pintar un estado de carga.

El guardián de rutas consulta los tres campos:

| `cargandoSesion` | `usuario` | Resultado |
| --- | --- | --- |
| `true` | — | Pinta `Cargando`, no redirige |
| `false` | presente | Deja pasar |
| `false` | ausente | Redirige a `/login` |

**Por qué no basta con `usuario === null`**: en el primer renderizado, con un token guardado válido, `usuario` todavía es `null` porque la comprobación contra `/api/auth/perfil` no ha respondido. Un guardián que solo mire `usuario` expulsaría a `/login` a alguien con sesión válida en cada recarga. Es el fallo clásico de este patrón y la razón de que el tercer estado sea explícito.

### 3. Restaurar la sesión valida el token contra `GET /api/auth/perfil`

Al montar, si hay token guardado, el contexto llama a `perfil`. Si responde `200`, fija `usuario` y da la sesión por buena. Si responde `401`, borra el token y deja la sesión vacía. Si falla por red, deja la sesión vacía y lo trata como no autenticado: sin poder confirmar el token, dar la sesión por buena llevaría a una pantalla que fallará en su primera petición real.

**Alternativa descartada**: decodificar la carga útil del JWT en el cliente para leer su `exp`. Dice cuándo caduca según el propio token, pero no si el backend lo sigue aceptando, y leer un dato de un token sin verificar su firma no es una comprobación de seguridad. Además obligaría a añadir un decodificador o a escribir uno.

**Coste asumido**: una petición extra en cada arranque con token. Es la única forma de tener una respuesta firme antes de decidir la ruta.

### 4. `servicios/api.js`: una función de transporte y un catálogo de llamadas

Un único `peticion(ruta, opciones)` construye la URL sobre `import.meta.env.VITE_API_URL`, fija `Content-Type` cuando hay cuerpo, adjunta `Authorization: Bearer <token>` si hay token, y normaliza la respuesta. Encima de él, una función por endpoint (`registrar`, `login`, `perfil`), que es lo que consumen el contexto y los hooks.

**El token no viaja como argumento en cada llamada**: el módulo guarda una referencia al token vigente, que `ContextoAuth` fija con un `establecerToken(token)` cada vez que la sesión cambia. Pasarlo por parámetro obligaría a cada componente futuro a leerlo del contexto y reenviarlo, que es exactamente lo que la spec prohíbe. La fuente de verdad sigue siendo el estado de React; el módulo solo guarda una copia que el contexto mantiene sincronizada.

**Todo error se normaliza a un `ErrorApi`** con `estadoHttp`, `codigo`, `mensaje` y `detalles`. Un fallo de red —donde `fetch` rechaza y no hay respuesta— produce un `ErrorApi` con `estadoHttp: 0` y un código propio `ERROR_RED`, de modo que la interfaz pueda distinguir "no he podido preguntar" de "me han dicho que no". Sin esa normalización, cada pantalla tendría que distinguir a mano una excepción de red de una respuesta de error.

### 5. La reacción al `401` vive en el transporte, con una excepción explícita

`peticion` acepta un indicador `esAutenticacion`. Cuando una respuesta llega con `401`:

- si `esAutenticacion` es `false` (todo lo demás), el módulo invoca un manejador que `ContextoAuth` le ha registrado: borra el token, vacía la sesión y marca el motivo como sesión caducada. Después lanza el `ErrorApi` igualmente, para que quien llamó no siga como si nada;
- si `esAutenticacion` es `true` (`login`, `registro` y la comprobación de arranque), no dispara nada: ese `401` significa "credenciales incorrectas" o "token guardado ya inválido", y quien llamó lo maneja.

**Por qué en el transporte y no en cada pantalla**: es la única forma de que la garantía se cumpla también en las pantallas que todavía no existen. Una regla que cada componente debe recordar es una regla que algún componente olvidará.

La redirección se dispara desde el guardián de rutas, no desde el módulo de API: cuando la sesión se vacía, el guardián deja de dejar pasar y redirige por sí solo. El módulo de API no conoce el router, y así no hay dos piezas navegando.

### 6. Registro y sesión: dos peticiones encadenadas

`POST /api/auth/registro` devuelve el usuario creado pero no un token. Para cumplir "tras un registro exitoso la persona queda autenticada", `registrar` en el contexto llama al registro y, si va bien, encadena el `login` con las mismas credenciales.

**Se descarta cambiar el backend** para que el registro devuelva token: alteraría un requisito vivo y ya especificado de la capability `autenticacion`, y este cambio se declaró sin modificaciones de backend. Si el registro va bien pero el `login` encadenado falla, la cuenta existe: la interfaz lo dice explícitamente e invita a iniciar sesión, en lugar de mostrar un error de registro que haría intentarlo de nuevo y chocar con un `409`.

### 7. La validación del cliente y los errores por campo comparten forma

La validación del cliente produce el mismo objeto `{ campo: motivo }` que el backend devuelve en `detalles` ante `DATOS_INVALIDOS`. Los formularios pintan errores por campo desde una única estructura, venga de donde venga. Es lo que hace que la validación del cliente sea un adelanto de la del servidor y no un segundo sistema.

Reglas del cliente, deliberadamente mínimas: campo no vacío; email que contenga una arroba con texto a ambos lados y un punto en el dominio; contraseña entre 8 y 72 bytes en UTF-8 (medida con `TextEncoder`, no con `.length`, porque el límite del backend es en bytes y un acento ocupa dos). No se comprueba nada más: cualquier regla adicional sería una copia que se desincroniza.

### 8. Estructura de carpetas y estilos

```
frontend/
  index.html
  vite.config.js
  .env.example
  src/
    main.jsx
    App.jsx                      # rutas
    servicios/api.js
    contextos/ContextoAuth.jsx
    hooks/useAuth.js
    paginas/Login.jsx  Registro.jsx  Tareas.jsx
    componentes/Comunes/Cargando.jsx  RutaProtegida.jsx  MensajeError.jsx
    estilos/  (variables y reset global)
```

Cada componente lleva su `.module.css` al lado. CSS Modules según fija el enunciado: sin librería de estilos, sin framework de utilidades. Un puñado de variables CSS globales (colores, espaciado, tipografía) en `estilos/`, para que las pantallas de los cambios siguientes no reinventen la paleta.

`useAuth.js` es un hook de una línea sobre `useContext` que lanza un error claro si se usa fuera del proveedor. Existe para que ningún componente importe el objeto de contexto directamente.

### 9. Vite y la URL de la API

`VITE_API_URL` (por defecto `http://localhost:3000`) se lee en `api.js`. Se elige la variable de entorno frente al proxy de desarrollo de Vite porque la variable funciona igual en desarrollo y en producción, mientras que el proxy solo existe durante el desarrollo y obligaría a un segundo mecanismo para desplegar. El backend ya tiene CORS abierto, así que la llamada entre orígenes funciona sin más.

## Risks / Trade-offs

- **El token en `localStorage` es legible por cualquier script del origen: un XSS lo expone** → Registrado y asumido en `proposal.md`. Mitigación dentro de lo que este cambio controla: React escapa por defecto lo que interpola, y este cambio no usa `dangerouslySetInnerHTML` en ningún sitio. La alternativa robusta (cookie `HttpOnly`) contradice el requisito vivo de que la cabecera `Authorization` sea el único portador de identidad, y sería un cambio de backend.
- **Una petición extra en cada arranque con token guardado** → Es el precio de decidir la ruta con una respuesta firme. Ocurre una sola vez por carga de página y se cubre con el estado de carga.
- **Dos pestañas abiertas se desincronizan: cerrar sesión en una deja la otra con su estado en memoria** → La otra pestaña seguirá pareciendo autenticada hasta su siguiente petición, que recibirá `401` y la cerrará. Se acepta: escuchar el evento `storage` para sincronizarlas es una mejora aditiva, sin caso de uso en el reto.
- **Dos peticiones en el registro: la segunda puede fallar dejando la cuenta creada** → La interfaz distingue explícitamente ese caso e invita a iniciar sesión, en lugar de mostrarlo como un fallo de registro.
- **Un `429` del rate limiting durante el inicio de sesión** → Tiene código estable propio, así que el formulario lo muestra como "demasiados intentos, espera un momento" y no como credenciales incorrectas.
- **El módulo de API guarda una copia del token fuera de React** → Si el contexto se olvidara de sincronizarla, una petición viajaría con un token viejo. Se acota manteniendo un único punto de escritura: el efecto de `ContextoAuth` que reacciona a cada cambio de `token`.
- **La pantalla `Tareas` mínima es un hueco que el cambio siguiente rellenará** → Deliberado y registrado, para que "redirige a la pantalla principal" sea verificable hoy.

## Migration Plan

No hay migración: el cambio solo añade la carpeta `frontend/`. El backend, la base de datos y sus datos quedan intactos. Revertirlo es borrar la carpeta y su entrada en `.gitignore`; nada de lo ya entregado depende de él.

Para ejecutarlo hacen falta dos procesos: el backend en el puerto 3000 y el servidor de desarrollo de Vite. Queda documentado en el README del frontend, y la instrucción de arranque conjunto se consolidará en el cambio de entrega.
