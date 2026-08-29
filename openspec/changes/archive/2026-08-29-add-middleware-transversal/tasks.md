## 1. Configuración y catálogo de errores

- [x] 1.1 Añadir `DEMASIADAS_PETICIONES` al catálogo `CODIGOS_ERROR` de `backend/src/utils/errores.js` y un constructor `errorDemasiadasPeticiones()` que devuelva un `ErrorAplicacion` de estado `429` con un mensaje genérico; verificar por inspección que el mensaje no menciona el inicio de sesión ni ningún número, de modo que sirva igual para el límite general y para el reforzado
- [x] 1.2 Añadir a `backend/src/config/env.js` la lectura de `RATE_LIMIT_VENTANA_MS` (por defecto `60000`), `RATE_LIMIT_MAX` (`100`), `RATE_LIMIT_LOGIN_VENTANA_MS` (`900000`) y `RATE_LIMIT_LOGIN_MAX` (`10`), exponiéndolas ya convertidas a número en el objeto `env`; verificar que arrancar sin ninguna de ellas definida sigue funcionando y que `env` devuelve los valores por defecto
- [x] 1.3 Extender `recogerProblemas` para que una de esas cuatro variables, presente pero que no sea un entero positivo, produzca un problema que nombre la variable y explique qué se esperaba; verificar con `RATE_LIMIT_MAX=0`, `RATE_LIMIT_MAX=abc` y `RATE_LIMIT_VENTANA_MS=-1` que el proceso termina con código 1 e imprime el motivo, y que una variable simplemente ausente no produce ningún problema
- [x] 1.4 Añadir la lectura y validación de `LOG_FORMATO` (`legible` por defecto, admite también `json`) y `LOG_NIVEL` (`info` por defecto, admite también `silencio`), rechazando en el arranque cualquier otro valor con un mensaje que enumere los admitidos; verificar que `LOG_FORMATO=xml` impide arrancar y que el mensaje lista `legible` y `json`
- [x] 1.5 Añadir la lectura de `TRUST_PROXY` (por defecto no confiar) y normalizarla al valor que espera `app.set('trust proxy', …)`, admitiendo al menos `false`, `true` y un número de saltos; verificar que un valor no reconocido impide arrancar
- [x] 1.6 Documentar las siete variables nuevas en `backend/.env.example` con el mismo tono que las existentes: qué hacen, su valor por defecto y, en el caso de `TRUST_PROXY`, la consecuencia de cada valor (bloqueo colectivo si se despliega tras un proxy sin activarlo; límite esquivable falsificando `X-Forwarded-For` si se activa sin proxy delante); verificar que copiar el archivo a `.env` sin editar nada permite arrancar la API

## 2. Middleware de limitación de peticiones

- [x] 2.1 Crear `backend/src/middleware/limitePeticiones.js` con una fábrica `crearLimitePeticiones({ ventanaMs, maximo })` que devuelva un middleware con su propio `Map` de estado, cerrado sobre la fábrica; verificar por inspección que no hay ningún estado a nivel de módulo compartido entre instancias, y que dos limitadores creados con la fábrica cuentan por separado
- [x] 2.2 Implementar el conteo por ventana fija: la clave es `req.ip`, y cada entrada guarda `{ contador, reinicioEn }`; una petición que llega con `Date.now() >= reinicioEn` reinicia la entrada, el resto incrementa. Verificar con un limitador de `maximo` bajo y ventana corta que la petición número `maximo` pasa, la `maximo + 1` no, y que tras esperar la ventana vuelve a pasar
- [x] 2.3 Hacer que la petición que supera el máximo llame a `siguiente(errorDemasiadasPeticiones())` en lugar de responder directamente; verificar que la respuesta obtenida tiene estado `429` y el cuerpo `{ error: { codigo: "DEMASIADAS_PETICIONES", mensaje } }`, con el mismo formato que cualquier otro error de la API
- [x] 2.4 Fijar `RateLimit-Limit`, `RateLimit-Remaining` y `RateLimit-Reset` en toda petición que el limitador evalúe, pase o no, con `RateLimit-Reset` en segundos restantes hasta el reinicio; añadir `Retry-After`, también en segundos, solo en el rechazo. Verificar con peticiones sucesivas que `RateLimit-Remaining` decrece hasta cero y que el `429` lleva `Retry-After`
- [x] 2.5 Añadir el barrido periódico que elimina del `Map` las entradas cuya ventana ya expiró, con `setInterval` de periodo igual a la ventana y `unref()` sobre el temporizador; verificar que el proceso termina solo (`node -e` que importe el módulo y no quede colgado) y que tras el barrido el tamaño del `Map` vuelve a bajar
- [x] 2.6 Verificar el aislamiento entre orígenes: con `TRUST_PROXY` activado, agotar la cuota enviando `X-Forwarded-For` con una IP y comprobar que otra IP distinta sigue siendo atendida con normalidad

## 3. Middleware de registro de peticiones

- [x] 3.1 Crear `backend/src/middleware/registro.js` con una fábrica `crearRegistroPeticiones({ formato, nivel })` que, cuando el nivel sea `silencio`, devuelva un middleware que solo llama a `siguiente()`; verificar por inspección que en ese camino no se engancha nada a la respuesta ni se toma ninguna marca de tiempo
- [x] 3.2 Implementar el camino activo: marca `process.hrtime.bigint()` al entrar, registra `res.on('finish', …)` y llama a `siguiente()` de inmediato; en `finish`, calcula la duración en milisegundos y compone la entrada con instante, método, `req.originalUrl`, código de estado, duración e IP de origen. Verificar que una petición a `GET /api/tareas?prioridad=alta` produce una sola línea que conserva la cadena de consulta
- [x] 3.3 Añadir a la entrada el identificador del usuario cuando la petición quedó autenticada, leyéndolo de la petición dentro del manejador de `finish` y no antes; verificar que una petición protegida con token válido registra el identificador, que una sin token lo registra como ausente, y que en ningún caso aparece el email
- [x] 3.4 Añadir la constancia de si la petición traía cabecera `Authorization`, como valor booleano; verificar por inspección que el módulo no lee `req.body` en ningún punto y que del valor de `Authorization` solo se evalúa su presencia, nunca su contenido
- [x] 3.5 Implementar los dos formatos: `legible` produce una línea alineada pensada para una terminal, y `json` produce una única línea por entrada con `JSON.stringify`, escrita con `process.stdout.write` más un `\n` explícito. Verificar que con `LOG_FORMATO=json` cada línea de la salida se analiza por separado con `JSON.parse` sin error
- [x] 3.6 Verificar que el registro escucha `finish` y no `close`: abortar una petición desde el cliente (`curl` interrumpido) no debe producir ninguna entrada, y ninguna entrada debe llevar un código de estado que no se llegó a enviar

## 4. Montaje en la aplicación

- [x] 4.1 Montar en `backend/src/app.js`, en este orden y por delante de todo lo existente: `crearRegistroPeticiones(...)`, luego `cors()`, luego `crearLimitePeticiones(...)` con los valores generales del entorno, y solo después `express.json()`; verificar que el orden en el archivo es exactamente ese y que los routers y los manejadores finales no se han movido
- [x] 4.2 Añadir `app.set('trust proxy', env.TRUST_PROXY)` en `app.js` —no en `server.js`—; verificar que un test o script que importe `app` directamente ve el ajuste aplicado
- [x] 4.3 Montar en `backend/src/rutas/authRutas.js` un segundo limitador, creado con los valores de login del entorno, únicamente sobre `POST /login`; verificar que `POST /api/auth/registro` no lo tiene aplicado inspeccionando el archivo
- [x] 4.4 Verificar el rechazo temprano: con el límite general agotado, una petición a una ruta inexistente devuelve `429` y no `404`, y una petición con cuerpo JSON mal formado devuelve `429` y no el `400` de JSON inválido, lo que demuestra que el límite se evalúa antes de `express.json()` y antes de resolver la ruta
- [x] 4.5 Verificar que la respuesta `429` llega al navegador con las cabeceras de CORS, comprobando que una petición con `Origin` distinto recibe `Access-Control-Allow-Origin` también en el rechazo

- [x] 4.6 Verificar que la comprobación previa de CORS no consume cuota: enviar una tanda de peticiones `OPTIONS` con `Origin` y `Access-Control-Request-Method` y comprobar que `RateLimit-Remaining` de la siguiente petición real no ha bajado por ellas

## 5. Verificación de extremo a extremo

- [x] 5.1 Con `RATE_LIMIT_MAX` bajado temporalmente, verificar el límite general contra la API en marcha: un bucle de peticiones a `GET /api/tareas` con token válido devuelve `200` hasta el máximo y `429` a partir de ahí, y vuelve a `200` pasada la ventana
- [x] 5.2 Con `RATE_LIMIT_LOGIN_MAX` bajado temporalmente, verificar el límite reforzado: una ráfaga de `POST /api/auth/login` con contraseña incorrecta devuelve `401` hasta el máximo y `429` después, sin llegar a comprobar credenciales; y a continuación una petición a `GET /api/categorias` con token válido sigue devolviendo `200`, demostrando que los dos contadores son independientes
- [x] 5.3 Verificar que un intento de inicio de sesión correcto también consume cuota: alternar intentos correctos e incorrectos hasta el máximo y comprobar que el bloqueo llega igual, sin que los aciertos repongan intentos
- [x] 5.4 Verificar que el límite reforzado no alcanza a `POST /api/auth/registro`: agotarlo con intentos de login y comprobar que a continuación un registro de cuenta válido sigue respondiendo `201`
- [x] 5.5 Verificar que el mensaje del `429` es idéntico en los dos casos de bloqueo y no permite deducir cuál de los dos límites se superó
- [x] 5.6 Verificar la redacción del registro: capturar la salida de la API mientras se ejecutan un registro de cuenta, un inicio de sesión y varias peticiones autenticadas, y comprobar mediante búsqueda en el texto capturado que no aparece ninguna de las contraseñas usadas, ni el token emitido, ni ningún fragmento suyo
- [x] 5.7 Verificar la cobertura del registro: en esa misma captura debe haber una entrada por cada petición realizada, incluidas las que devolvieron `401`, `404` y `429`, cada una con su método, su ruta, su código de estado y su tiempo de respuesta
- [x] 5.8 Verificar el nivel de silencio: con `LOG_NIVEL=silencio`, ejecutar el mismo recorrido y comprobar que la salida no contiene ninguna entrada de registro y que todas las respuestas siguen siendo las mismas

## 6. Cierre

- [x] 6.1 Ejecutar `openspec validate --changes add-middleware-transversal --strict` y comprobar que pasa
- [x] 6.2 Revisar que ninguna dependencia se ha añadido a `backend/package.json` comparándolo con la versión anterior en git, y que `backend/.env.example` documenta exactamente las variables que `src/config/env.js` lee
- [x] 6.3 Restaurar en el `.env` local los valores por defecto de los límites que se bajaron para las verificaciones, y comprobar con una sesión normal de uso de la API que ningún flujo legítimo choca contra el límite general
