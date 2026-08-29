## Purpose

Define el armazón de la aplicación autenticada: la estructura visual común que envuelve toda pantalla que exige sesión (cabecera con identidad y cierre de sesión, navegación lateral, área de contenido), su comportamiento en pantallas estrechas, el límite que impide que un fallo de render deje la interfaz en blanco, y el componente común con el que cualquier pantalla muestra un error de negocio previsible.

## ADDED Requirements

### Requirement: Estructura común de las pantallas autenticadas
La aplicación MUST envolver toda pantalla que exija sesión en una estructura común que presente, de forma persistente, una cabecera, una navegación entre las secciones de la aplicación y un área donde se renderiza el contenido propio de la pantalla. Las pantallas de inicio de sesión y de registro MUST NOT usar esa estructura: se muestran solas, ocupando toda la ventana.

#### Scenario: Una pantalla autenticada se muestra dentro del armazón
- **WHEN** una persona con sesión activa abre una pantalla que exige autenticación
- **THEN** ve la cabecera y la navegación de la aplicación alrededor del contenido de esa pantalla, sin que la pantalla tenga que dibujarlos por su cuenta

#### Scenario: Las pantallas de autenticación se muestran sin armazón
- **WHEN** se muestra la pantalla de inicio de sesión o la de registro
- **THEN** ocupan toda la ventana y no aparecen ni la cabecera ni la navegación de la aplicación

#### Scenario: La estructura es la misma entre secciones
- **WHEN** una persona navega de una sección autenticada a otra
- **THEN** la cabecera y la navegación permanecen en su sitio y solo cambia el área de contenido

### Requirement: La cabecera muestra la identidad y ofrece cerrar sesión
La cabecera del armazón MUST mostrar de forma reconocible a la persona autenticada (su nombre o, en su defecto, su email) y MUST ofrecer la acción de cierre de sesión. Al ejecutar esa acción, el comportamiento MUST ser el que ya define la capability `frontend-autenticacion`: se vacía la sesión, se descarta el token guardado y se lleva a la persona a la pantalla de inicio de sesión.

#### Scenario: La cabecera identifica a la persona autenticada
- **WHEN** se muestra una pantalla autenticada
- **THEN** la cabecera indica quién tiene la sesión iniciada

#### Scenario: Cierre de sesión desde la cabecera
- **WHEN** una persona autenticada ejecuta la acción de cerrar sesión desde la cabecera
- **THEN** la aplicación deja de considerarla autenticada y muestra la pantalla de inicio de sesión, sin que el armazón tenga que navegar a mano

### Requirement: Navegación entre las secciones de la aplicación
El armazón MUST ofrecer una navegación lateral con un enlace por cada sección autenticada que exista en la aplicación, y MUST señalar cuál es la sección activa. La navegación MUST NOT ofrecer enlaces a secciones que todavía no tienen pantalla.

#### Scenario: Ir a una sección desde la navegación
- **WHEN** una persona autenticada elige una sección en la navegación lateral
- **THEN** el área de contenido pasa a mostrar esa sección y la navegación marca ese destino como activo

#### Scenario: La sección activa se refleja al entrar directamente por su dirección
- **WHEN** una persona abre directamente la dirección de una sección autenticada
- **THEN** la navegación lateral marca esa sección como activa

#### Scenario: No hay enlaces a secciones inexistentes
- **WHEN** se inspecciona la navegación lateral
- **THEN** solo aparecen enlaces a secciones que tienen una pantalla real

### Requirement: El armazón es utilizable en pantallas estrechas
En pantallas anchas la navegación lateral MUST ser visible de forma permanente junto al contenido. En pantallas estrechas la navegación MUST ocultarse tras un control accesible que la despliega como panel superpuesto sobre el contenido y la vuelve a ocultar al elegir un destino o al cerrarlo explícitamente. La aplicación MUST NOT mostrar en pantalla estrecha una versión reducida e ilegible del diseño de escritorio, y el contenido principal MUST seguir siendo legible sin desplazamiento horizontal.

#### Scenario: Pantalla ancha
- **WHEN** se usa la aplicación en una ventana ancha
- **THEN** la navegación lateral se ve junto al contenido sin necesidad de abrir nada

#### Scenario: Pantalla estrecha, navegación colapsada
- **WHEN** se usa la aplicación en una ventana estrecha
- **THEN** la navegación lateral no ocupa espacio permanente y hay un control visible y accesible para abrirla

#### Scenario: Abrir y usar la navegación en pantalla estrecha
- **WHEN** en pantalla estrecha se abre la navegación y se elige un destino
- **THEN** la aplicación navega a ese destino y la navegación se cierra

#### Scenario: El contenido no desborda en horizontal
- **WHEN** se muestra cualquier pantalla autenticada en una ventana estrecha
- **THEN** el contenido principal se lee sin desplazamiento horizontal de la página

### Requirement: Un fallo de render no deja la interfaz en blanco
La aplicación MUST envolver su árbol principal en al menos un límite de error. Si un componente lanza un error durante el render, el límite MUST mostrar una pantalla de error genérica y comprensible en lugar de una pantalla en blanco o el error crudo de React, y MUST ofrecer al menos una vía de recuperación (recargar la aplicación o volver al inicio). La pantalla de error MUST NOT exponer detalles técnicos internos como la traza de la pila.

#### Scenario: Un componente falla al renderizar
- **WHEN** un componente lanza un error inesperado durante el render
- **THEN** la aplicación muestra una pantalla de error genérica y amigable, no una pantalla en blanco ni el mensaje de error sin formato

#### Scenario: Recuperación tras el error
- **WHEN** se muestra la pantalla de error del límite
- **THEN** ofrece al menos una acción para volver a un estado usable de la aplicación

#### Scenario: La pantalla de error no filtra detalles internos
- **WHEN** se muestra la pantalla de error del límite
- **THEN** no aparece la traza de la pila ni ningún detalle técnico interno

### Requirement: Componente común para los errores de negocio previsibles
La aplicación MUST ofrecer un componente reutilizable para mostrar errores previsibles de la aplicación —fallos de la API, rechazos de validación del servidor, credenciales inválidas— que toda pantalla usa en lugar de dibujar su propio mensaje de error. Ese componente es distinto del límite de error: el límite cubre fallos de render inesperados; este cubre fallos que la aplicación anticipa y sabe nombrar. El componente MUST anunciar el error a las tecnologías de asistencia y MUST distinguir visualmente un error de un aviso informativo (por ejemplo, una sesión caducada).

#### Scenario: Una pantalla muestra un error de negocio
- **WHEN** una operación de una pantalla falla con un motivo que la aplicación puede nombrar
- **THEN** la pantalla muestra ese motivo con el componente común de error, sin construir su propia presentación

#### Scenario: El error se anuncia a un lector de pantalla
- **WHEN** el componente común de error muestra un mensaje
- **THEN** una tecnología de asistencia anuncia ese mensaje sin que el foco tenga que moverse hasta él

#### Scenario: Aviso frente a error
- **WHEN** el mensaje a mostrar es un aviso informativo y no un fallo de lo que la persona acaba de hacer
- **THEN** el componente lo presenta de forma visualmente distinta a un error y lo anuncia como información, no como alerta

#### Scenario: Sin mensaje no hay nada que mostrar
- **WHEN** no hay ningún error ni aviso activo
- **THEN** el componente no ocupa espacio ni deja rastro visible en la pantalla
