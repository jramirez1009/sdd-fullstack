## ADDED Requirements

### Requirement: La interfaz de autenticación sigue el árbol de carpetas del reto

El reto técnico evalúa la "estructura y reutilización de componentes" y publica un árbol
de carpetas de referencia. La interfaz de autenticación MUST ubicar sus archivos donde ese
árbol los nombra, para que quien revisa el proyecto encuentre cada pieza donde la espera.

- Los formularios de inicio de sesión y de registro MUST vivir en
  `frontend/src/componentes/Auth/`, con los nombres `FormularioLogin.jsx` y
  `FormularioRegistro.jsx`, como componentes reutilizables. Cada uno MUST llevar su
  `.module.css` con el mismo nombre al lado.
- Los formularios MUST NOT contener una capa intermedia de "página": la definición de
  rutas MUST enrutar directamente a `FormularioLogin` y `FormularioRegistro`.
- El estado compartido de sesión (el contexto de autenticación descrito en el requisito
  "La sesión vive en un único estado compartido") MUST residir en
  `frontend/src/contexto/` (carpeta en singular, como la nombra el árbol del reto).
- `frontend/src/paginas/` MUST NOT contener piezas de autenticación.

Este requisito solo fija ubicación y nombre de archivo; no altera ningún comportamiento de
registro, inicio de sesión, persistencia de sesión ni manejo de errores.

#### Scenario: Formularios de autenticación como componentes reutilizables
- **WHEN** se inspecciona el árbol de archivos del frontend
- **THEN** los formularios de inicio de sesión y de registro están en
  `frontend/src/componentes/Auth/FormularioLogin.jsx` y
  `frontend/src/componentes/Auth/FormularioRegistro.jsx`, cada uno con su
  `.module.css` homónimo al lado, y no hay ningún archivo de autenticación bajo
  `frontend/src/paginas/`

#### Scenario: Contexto de sesión en carpeta singular
- **WHEN** se localiza el módulo que mantiene el estado compartido de autenticación
- **THEN** se encuentra bajo `frontend/src/contexto/` y no existe una carpeta
  `frontend/src/contextos/`

#### Scenario: Enrutado directo sin capa de página
- **WHEN** se revisa la definición de rutas de la aplicación
- **THEN** las rutas de inicio de sesión y de registro renderizan directamente los
  componentes `FormularioLogin` y `FormularioRegistro`, sin un componente de página
  intermedio

#### Scenario: El comportamiento de autenticación no cambia
- **WHEN** una persona se registra, inicia sesión, provoca un error de validación o de
  credenciales, o recarga la página con una sesión activa
- **THEN** el resultado observable es idéntico al anterior a esta reorganización: la
  sesión se establece, los mensajes de error se muestran igual y el token sigue
  persistiendo en el almacenamiento del navegador
