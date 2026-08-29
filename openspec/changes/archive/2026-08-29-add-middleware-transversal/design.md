## Context

Ver `proposal.md — Why` para la motivación. Lo relevante para el diseño es el estado actual del backend:

- `src/app.js` monta, en este orden: `cors()`, `express.json()`, el router de `/api/auth` (público) y los routers de categorías, etiquetas y tareas (protegidos por `requiereAutenticacion` al montar); después `manejadorNoEncontrado` y `manejadorErrores`.
- `manejadorErrores` es el único punto del sistema que construye una respuesta de error, y traduce cualquier `ErrorAplicacion` (`estadoHttp`, `codigo`, `mensaje`, `detalles?`) al formato `{ error: { codigo, mensaje, detalles? } }`. Los códigos viven en `CODIGOS_ERROR`.
- `src/config/env.js` se ejecuta como efecto de importación: carga el `.env`, recoge problemas mediante `recogerProblemas(entorno)`, y si hay alguno imprime la lista y llama a `process.exit(1)`. Exporta un objeto `env` congelado de hecho, con los valores ya normalizados.
- `requiereAutenticacion` deja el usuario del token en la petición; el registro necesita leer ese identificador, pero se monta muy por delante de él.
- No hay ninguna dependencia de infraestructura además de `express`, `cors`, `pg`, `dotenv`, `jsonwebtoken` y `bcrypt`. Este cambio no añade ninguna.

La restricción que gobierna el diseño es el orden de montaje: el registro debe ver todas las peticiones (incluidas las que el límite rechaza), y el límite debe rechazar antes de que se gaste trabajo en analizar el cuerpo.

## Goals / Non-Goals

**Goals:**

- Dos middlewares independientes entre sí, que no se conozcan ni compartan estado: uno mide y escribe, el otro cuenta y rechaza.
- Rechazo por límite indistinguible en forma del resto de errores de la API: mismo cuerpo, mismo camino por `manejadorErrores`.
- Un único punto de configuración (`src/config/env.js`) que valide al arrancar, con la política ya vigente de no arrancar con configuración inválida.
- Coste por petición despreciable: el límite es una búsqueda en un mapa y dos enteros; el registro, una marca de tiempo y una línea.
- Registro que no pueda filtrar credenciales por construcción, no por una lista de campos censurados.

**Non-Goals:**

- Contadores compartidos entre varias instancias del proceso, y por tanto cualquier almacén externo.
- Ventana deslizante, cuotas por plan, o cualquier forma de reparto de capacidad más fina que "tantas peticiones por ventana".
- Niveles de registro por categoría de mensaje, transportes, o cualquier cosa que se parezca a un `winston` escrito a mano. El nivel solo decide si se escribe o no.
- Persistencia del registro, rotación de ficheros, métricas agregadas o alertas.

## Decisions

### Orden de montaje en `app.js`

```
registroPeticiones      ← el primero: ve todas las peticiones, incluidas las rechazadas
cors()                  ← única excepción al "rechazar cuanto antes" (ver abajo)
limiteGeneral           ← antes de express.json(): no analiza el cuerpo de lo que va a rechazar
express.json()
/api/auth (con limiteLogin sobre POST /login)
/api/categorias, /api/etiquetas, /api/tareas  (requiereAutenticacion)
manejadorNoEncontrado
manejadorErrores
```

`cors()` se mantiene por delante del límite. Sin sus cabeceras, el navegador oculta al JavaScript de la SPA la respuesta `429` y el frontend ve un fallo de red indistinguible de un servidor caído. Es la única excepción al principio de "rechazar cuanto antes"; su coste es fijar unas cabeceras, y a cambio el frontend puede mostrar "vas demasiado rápido" en lugar de "no hay conexión".

Alternativa descartada: montar el límite dentro de cada router. Multiplicaría los puntos donde un router futuro puede quedarse sin proteger, exactamente el problema que `app.js` ya resuelve para la autenticación montando el middleware al montar el router.

### El limitador: fábrica que devuelve un middleware con su propio estado

`crearLimitePeticiones({ ventanaMs, maximo })` devuelve un middleware que cierra sobre su propio `Map`. Dos llamadas producen dos limitadores con contadores independientes, que es exactamente la relación que la spec pide entre el general y el de login.

Estado por clave: `{ contador, reinicioEn }`. En cada petición, si `Date.now() >= reinicioEn` la entrada se reinicia (`contador = 1`, `reinicioEn = ahora + ventanaMs`); si no, `contador++`. Si `contador > maximo`, se llama a `siguiente(errorDemasiadasPeticiones())`.

- **`Map` frente a objeto plano**: el `Map` no tiene prototipo que envenenar con una clave `__proto__`, y la clave es una cadena controlada por el cliente (su IP tal como la reporta Express). Es una defensa gratuita.
- **Ventana fija frente a deslizante**: ver la decisión registrada en `proposal.md`. Dos enteros por IP frente a una lista de marcas de tiempo por IP, cuyo tamaño lo elige el atacante.
- **Purga de entradas caducadas**: sin purga, el `Map` crece con cada IP vista y no baja nunca — una fuga de memoria dirigible desde fuera. Se resuelve con un barrido periódico (`setInterval` con `unref()`, para que no impida al proceso terminar) que elimina las entradas cuya ventana ya expiró. Se descarta purgar en cada petición: recorrer el mapa entero por petición convierte un `O(1)` en `O(n)` justo cuando `n` es grande, que es cuando peor viene.

### Las cabeceras del límite

`RateLimit-Limit`, `RateLimit-Remaining` y `RateLimit-Reset` se fijan siempre que el limitador evalúa la petición, tanto si la deja pasar como si la rechaza. `Retry-After`, solo en el rechazo. `RateLimit-Reset` y `Retry-After` viajan en segundos restantes y no en un instante absoluto: no dependen de que el reloj del cliente esté en hora.

Cuando ambos limitadores actúan sobre la misma petición (el login), el segundo sobrescribe las cabeceras del primero. Es aceptable y coherente con la spec, que no promete de qué límite informan las cabeceras cuando hay dos, y con la decisión de que el mensaje de rechazo no distinga cuál se superó.

### El error: un `ErrorAplicacion` más

El limitador no responde: llama a `siguiente(error)` y deja que `manejadorErrores` construya el cuerpo, igual que hace todo el sistema. Añadir `DEMASIADAS_PETICIONES` a `CODIGOS_ERROR` y un constructor `errorDemasiadasPeticiones()` que devuelva un `ErrorAplicacion(429, …)` es todo lo que hace falta; el manejador ya sabe traducirlo.

Alternativa descartada: `res.status(429).json(...)` dentro del limitador. Duplicaría la construcción del cuerpo de error en un segundo lugar, que es justo lo que `manejadorErrores` existe para impedir.

### El registro: se engancha a `finish` de la respuesta

El middleware anota `process.hrtime.bigint()` al entrar, registra un manejador de `res.on('finish', …)` y llama a `siguiente()` inmediatamente. Al terminar la respuesta, calcula la duración y escribe la entrada. `hrtime` y no `Date.now()` porque un ajuste de reloj no debe producir tiempos de respuesta negativos.

Se escucha `finish` y no `close`: `close` dispara también cuando el cliente aborta, y produciría entradas con un código de estado que nunca se envió. Consecuencia aceptada: una petición abortada no deja entrada.

**El identificador del usuario**: el registro se monta muy por delante de `requiereAutenticacion`, así que no puede leerlo al entrar. Pero el manejador de `finish` se ejecuta al final, cuando `requiereAutenticacion` ya ha dejado el usuario en la petición si la ruta estaba protegida. Se lee ahí, no antes. Esto es lo que hace que el dato esté disponible sin acoplar los dos middlewares: el registro no sabe quién lo puso, solo lee un campo que puede estar o no.

**La ruta**: se registra `req.originalUrl`, que incluye la cadena de consulta. No se registra `req.route.path` (la plantilla, `/api/tareas/:id`) porque en el momento de `finish` puede no existir — una petición rechazada por el límite nunca resolvió ruta.

### La redacción de datos sensibles es estructural

El registro no tiene una función `censurar(cuerpo)`. Sencillamente no accede a `req.body` en ningún punto, y de la cabecera `Authorization` solo evalúa su presencia como booleano. Una lista de campos a censurar es una lista que alguien olvidará ampliar cuando llegue un endpoint nuevo; no leer el cuerpo no se olvida.

### Formatos y nivel

`LOG_FORMATO` admite `legible` y `json`; `LOG_NIVEL` admite `info` y `silencio`. El nivel se comprueba una sola vez al construir el middleware: si es `silencio`, la fábrica devuelve un middleware que solo llama a `siguiente()`, sin enganchar nada a la respuesta. Un test no paga ni el `finish` ni el `hrtime`.

El formato `json` emite una línea por entrada con `JSON.stringify` — no un JSON multilínea, que ningún agregador sabe leer por líneas. La escritura va por `process.stdout.write` con un `\n` explícito y no por `console.log`, para no depender de cómo `console` decide formatear un objeto.

### Configuración

`src/config/env.js` gana la lectura y validación de las siete variables nuevas dentro de `recogerProblemas`, y las expone ya normalizadas en `env`: los milisegundos y los máximos como números, el formato y el nivel como cadenas de un conjunto cerrado, y `TRUST_PROXY` interpretado como lo espera `app.set('trust proxy', …)`.

Un valor ausente toma su valor por defecto sin protestar; un valor presente pero inválido detiene el arranque. La distinción importa: "no lo he configurado" es normal, "lo he configurado mal" es un error que en producción pasaría inadvertido y dejaría un límite distinto del que alguien creyó fijar.

Valores por defecto propuestos: `RATE_LIMIT_VENTANA_MS=60000` con `RATE_LIMIT_MAX=100` (holgado para una SPA que carga varias listas al abrirse, estrecho para un bucle), y `RATE_LIMIT_LOGIN_VENTANA_MS=900000` con `RATE_LIMIT_LOGIN_MAX=10` (diez intentos por cuarto de hora: sobra para quien no recuerda su contraseña, arruina un diccionario). `LOG_FORMATO=legible`, `LOG_NIVEL=info`, `TRUST_PROXY=false`.

### `trust proxy`

`app.set('trust proxy', env.TRUST_PROXY)` en `app.js`, no en `server.js`: es una propiedad de la aplicación Express, y dejarla en el arranque del servidor la haría inaccesible a un test que importe `app` directamente — precisamente donde hay que verificar que el límite no se esquiva falsificando `X-Forwarded-For`.

## Risks / Trade-offs

- **Los contadores viven en memoria: reiniciar el proceso los vacía** → Un atacante que pueda provocar reinicios repone su cuota. En la práctica, quien puede reiniciar el proceso tiene problemas mayores que el rate limiting. Queda registrado como limitación conocida.
- **Varias instancias multiplicarían el límite efectivo por su número** → No se mitiga: el despliegue es de un proceso. Si algún día hay varias, el cambio es sustituir el `Map` por un almacén compartido detrás de la misma fábrica, que es el punto donde el diseño lo deja aislado.
- **Una IP compartida por muchas personas (NAT de una oficina, una universidad) agota la cuota antes** → Mitigado dimensionando el límite general con holgura y no aplicando el reforzado al registro de cuentas. Es el precio conocido de limitar por IP, y el reto no pide otra cosa.
- **`trust proxy` mal configurado rompe el límite en una de dos direcciones** → Mitigado con el valor por defecto seguro (no confiar) y documentándolo en `.env.example` con la consecuencia de cada valor. No hay forma de acertar automáticamente: solo el despliegue sabe si hay un proxy delante.
- **El barrido periódico corre aunque no lleguen peticiones** → Con `unref()` no impide que el proceso termine y su coste es recorrer un mapa una vez por ventana. Despreciable frente a la fuga que evita.
- **El registro escribe una línea por petición en la salida estándar, de forma síncrona sobre un fichero redirigido** → En volúmenes altos podría notarse. Fuera del alcance de este entregable; el nivel `silencio` y el formato `json` cubren los dos escenarios que importan hoy (tests y agregador).
- **Una petición abortada por el cliente no deja entrada** → Consecuencia de escuchar `finish` en vez de `close`. Se prefiere un registro sin entradas fantasma a uno completo con códigos de estado inventados.

## Migration Plan

No hay migración: no se toca la base de datos, no cambia ningún contrato de API y las variables nuevas tienen valores por defecto. Desplegar es desplegar el código; quien clone el repositorio no necesita tocar su `.env` para que la aplicación arranque con los límites activos.

Revertir es retirar los dos `app.use` de `app.js` y el `limiteLogin` de `authRutas.js`; nada más depende de ellos.
