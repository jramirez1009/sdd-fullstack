## 1. Andamiaje del proyecto de frontend

- [x] 1.1 Crear `frontend/` con Vite y React (`package.json`, `vite.config.js` con `@vitejs/plugin-react`, `index.html`, `src/main.jsx`) y añadir `react-router-dom`; verificar que `npm install && npm run dev` levanta el servidor de desarrollo y sirve una página en blanco sin errores en consola
- [x] 1.2 Crear la estructura de carpetas `src/servicios/`, `src/contextos/`, `src/hooks/`, `src/paginas/`, `src/componentes/Comunes/` y `src/estilos/`; verificar que las carpetas existen y coinciden con la estructura descrita en `design.md` § 8
- [x] 1.3 Añadir `frontend/.env.example` documentando `VITE_API_URL` (con `http://localhost:3000` como valor de ejemplo) y extender `.gitignore` con `frontend/node_modules` y `frontend/.env`; verificar con `git status` que ni `node_modules` ni `.env` aparecen como no rastreados
- [x] 1.4 Crear `src/estilos/global.css` con el reset mínimo y las variables CSS de color, espaciado y tipografía, e importarlo desde `main.jsx`; verificar que la página aplica la tipografía y el color de fondo definidos

## 2. Servicio de API

- [x] 2.1 Implementar en `src/servicios/api.js` la función `peticion(ruta, opciones)`: URL sobre `import.meta.env.VITE_API_URL`, cabecera `Content-Type` cuando hay cuerpo, y `Authorization: Bearer <token>` cuando hay token vigente; verificar en la pestaña de red del navegador que una llamada con sesión lleva la cabecera y una sin sesión no la lleva
- [x] 2.2 Implementar la clase `ErrorApi` (`estadoHttp`, `codigo`, `mensaje`, `detalles`) y la normalización de toda respuesta de error de la API a esa forma; verificar que un `400` con `DATOS_INVALIDOS` llega al llamador con su `codigo` y sus `detalles` por campo intactos
- [x] 2.3 Normalizar el fallo de red (rechazo de `fetch`, sin respuesta) a un `ErrorApi` con `estadoHttp: 0` y código `ERROR_RED`; verificar apagando el backend que la llamada produce ese error y no una excepción sin tratar
- [x] 2.4 Implementar `establecerToken(token)` y el registro del manejador de sesión caducada (`alPerderSesion`) que el contexto instalará; verificar que llamar a `establecerToken(null)` hace que la siguiente petición no incluya la cabecera de autorización
- [x] 2.5 Implementar la reacción al `401`: si la llamada no está marcada como `esAutenticacion`, invocar el manejador de sesión caducada y lanzar el `ErrorApi` igualmente; si lo está, solo lanzarlo; verificar con un token manipulado a mano en `localStorage` que una llamada protegida cierra la sesión y que un `login` con credenciales incorrectas no la cierra
- [x] 2.6 Añadir las funciones por endpoint `registrar(email, password)`, `login(email, password)` y `perfil()`, las tres marcadas como `esAutenticacion`; verificar que cada una devuelve el cuerpo de la respuesta ya analizado ante un caso correcto

## 3. Validación en el cliente

- [x] 3.1 Implementar las comprobaciones de campo requerido, formato de email y longitud de contraseña entre 8 y 72 bytes UTF-8 (medida con `TextEncoder`, no con `.length`), devolviendo un objeto `{ campo: motivo }` con la misma forma que los `detalles` de la API; verificar que una contraseña de 8 caracteres acentuados (16 bytes) pasa y que una de 40 caracteres acentuados (80 bytes) se rechaza

## 4. Estado de sesión

- [x] 4.1 Implementar `src/contextos/ContextoAuth.jsx` con el estado `{ usuario, token, cargandoSesion }`, arrancando `cargandoSesion` en `true` solo si hay token en `localStorage`; verificar que sin token guardado la aplicación no muestra estado de carga al abrirse
- [x] 4.2 Implementar la restauración de sesión al montar: con token guardado, llamar a `perfil()`; ante `200` fijar el usuario, ante `401` borrar el token, y ante fallo de red dejar la sesión vacía; en los tres casos poner `cargandoSesion` en `false`; verificar recargando con sesión válida que la sesión se mantiene, y con un token caducado que lleva a `/login`
- [x] 4.3 Implementar `iniciarSesion(email, password)`: llamar a `login`, guardar el token en `localStorage` y fijar el estado; verificar que tras iniciar sesión el token está en `localStorage` y el usuario en el estado
- [x] 4.4 Implementar `registrar(email, password)` encadenando el registro y el inicio de sesión con las mismas credenciales, y distinguiendo el caso de registro correcto con inicio de sesión fallido; verificar que un registro válido deja la sesión iniciada sin pedir credenciales otra vez
- [x] 4.5 Implementar `cerrarSesion()`: vaciar el estado y borrar el token de `localStorage`; verificar que tras ejecutarlo y recargar, la aplicación no restaura ninguna sesión
- [x] 4.6 Sincronizar el token con el servicio de API mediante un efecto que llame a `establecerToken` en cada cambio de `token`, e instalar `alPerderSesion` apuntando a `cerrarSesion` con motivo de caducidad; verificar iniciando sesión con dos cuentas seguidas que la segunda sesión no envía el token de la primera
- [x] 4.7 Implementar `src/hooks/useAuth.js` sobre `useContext`, lanzando un error explícito si se usa fuera del proveedor; verificar que un componente montado fuera del proveedor falla con ese mensaje y no con un error de propiedad indefinida

## 5. Componentes comunes y rutas

- [x] 5.1 Implementar `componentes/Comunes/Cargando.jsx` con su módulo CSS y una etiqueta accesible del estado de carga; verificar que se anuncia como región activa a un lector de pantalla (`role="status"`)
- [x] 5.2 Implementar `componentes/Comunes/MensajeError.jsx` con su módulo CSS para los errores de formulario y de sesión; verificar que un error se muestra visible y con contraste suficiente en la pantalla de inicio de sesión
- [x] 5.3 Implementar `componentes/Comunes/RutaProtegida.jsx` con la tabla de decisión de `design.md` § 2: `cargandoSesion` pinta `Cargando`, sin usuario redirige a `/login`, con usuario deja pasar; verificar que recargar en `/tareas` con sesión válida no pasa nunca por `/login`
- [x] 5.4 Definir las rutas en `App.jsx` (`/login`, `/registro`, `/tareas` protegida, y cualquier otra dirección redirigida según haya sesión o no) y montar `BrowserRouter` y el proveedor de sesión en `main.jsx`; verificar tecleando directamente `/tareas` sin sesión que lleva a `/login`, y `/login` con sesión que lleva a `/tareas`

## 6. Pantallas de autenticación

- [x] 6.1 Implementar `paginas/Login.jsx` con su módulo CSS: campos de email y contraseña (la contraseña con el campo enmascarado), errores por campo, error general y enlace a registro; verificar que el formulario se envía también con la tecla Intro
- [x] 6.2 Mapear en `Login.jsx` los códigos de error de la API a mensajes: `CREDENCIALES_INVALIDAS` a un texto único que no distingue email de contraseña, `DEMASIADAS_PETICIONES` a un aviso de esperar, `ERROR_RED` a un fallo de conexión; verificar que un email inexistente y una contraseña equivocada producen exactamente el mismo texto
- [x] 6.3 Implementar el estado de envío en `Login.jsx`: mostrar `Cargando`, deshabilitar el botón mientras la petición está en vuelo y rehabilitarlo al terminar; verificar con la red ralentizada que varios clics seguidos producen una sola petición en la pestaña de red
- [x] 6.4 Implementar `paginas/Registro.jsx` con su módulo CSS, la validación del cliente antes de llamar a la API, los errores por campo procedentes de `detalles`, el mismo estado de envío que el inicio de sesión y enlace a la pantalla de inicio de sesión; verificar que un email mal formado no produce ninguna petición en la pestaña de red
- [x] 6.5 Mapear en `Registro.jsx` `EMAIL_DUPLICADO` a un mensaje claro conservando lo escrito, y el caso de registro correcto con inicio de sesión fallido a un mensaje que invite a iniciar sesión; verificar registrando dos veces el mismo email que el segundo intento explica el motivo y no borra el formulario
- [x] 6.6 Implementar `paginas/Tareas.jsx` mínima: saludo al usuario autenticado y botón de cerrar sesión; verificar que el botón vacía la sesión y lleva a `/login`
- [x] 6.7 Mostrar en `Login.jsx` el aviso de sesión caducada cuando se llega por expiración del token, y no mostrarlo cuando se llega por credenciales incorrectas o por una visita normal; verificar ambos caminos

## 7. Verificación de extremo a extremo

- [x] 7.1 Recorrer el flujo completo con el backend en marcha: registro con una cuenta nueva, aterrizaje en `/tareas`, recarga (la sesión sobrevive), cierre de sesión, nuevo inicio de sesión y recarga; verificar que ningún paso pide credenciales de más ni muestra una pantalla intermedia rota
- [x] 7.2 Forzar la expiración manipulando el token guardado en `localStorage` y provocando una llamada protegida; verificar que la aplicación borra el token, cierra la sesión y lleva a `/login` con el aviso de caducidad, sin dejar visible una pantalla protegida vacía
- [x] 7.3 Detener el backend y ejercitar el inicio de sesión, el registro y el arranque con token guardado; verificar que los tres muestran un error de conexión distinguible de un error de credenciales y que se puede reintentar sin recargar
- [x] 7.4 Revisar la consola del navegador y la pestaña de red tras un registro, un inicio de sesión y un fallo de cada uno; verificar que el JWT y las contraseñas no aparecen en ningún registro de consola
- [x] 7.5 Comprobar la interfaz en ancho de móvil y de escritorio y navegar los dos formularios solo con teclado; verificar que nada se desborda, que el foco recorre los campos en orden y que los errores quedan asociados a su campo
- [x] 7.6 Ejecutar `openspec validate add-frontend-autenticacion --strict` y contrastar cada requisito de `specs/frontend-autenticacion/spec.md` con lo implementado; verificar que la validación pasa y que no queda ningún escenario sin comportamiento correspondiente
