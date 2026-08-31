## Purpose

Define la preferencia de tema visual de la aplicación autenticada: cómo se elige el tema inicial, cómo la persona lo alterna entre claro y oscuro desde la cabecera, cómo el cambio se aplica al instante a toda la interfaz y cómo se recuerda entre visitas.

## Requirements

### Requirement: La aplicación ofrece tema claro y tema oscuro

La aplicación MUST ofrecer exactamente dos temas visuales, "claro" y "oscuro", y MUST aplicar uno de ellos en todo momento a toda la interfaz autenticada. Ambos temas MUST mantener el contraste de texto y elementos interactivos en un nivel accesible. Cambiar de tema MUST alterar únicamente colores; el resto del diseño (espaciado, tipografía, disposición) MUST permanecer idéntico.

#### Scenario: Un tema activo en todo momento

- **WHEN** se muestra cualquier pantalla autenticada
- **THEN** toda la interfaz se presenta con un único tema coherente, claro u oscuro, sin zonas que conserven el otro tema

#### Scenario: El cambio de tema solo afecta a los colores

- **WHEN** la persona pasa de un tema al otro
- **THEN** cambian los colores de fondo, superficie, texto y acentos, y la posición y el tamaño de los elementos no se alteran

### Requirement: El tema inicial sigue la preferencia del sistema

En ausencia de una elección manual previa, la aplicación MUST adoptar como tema inicial el que indique la preferencia del sistema operativo de la persona (equivalente a `prefers-color-scheme`): tema oscuro si el sistema pide oscuro, tema claro en cualquier otro caso. Si esa preferencia del sistema cambia mientras la aplicación está abierta y la persona no ha hecho ninguna elección manual, la aplicación MUST reflejar el nuevo valor.

#### Scenario: Primera visita con el sistema en oscuro

- **WHEN** una persona que nunca ha elegido tema abre la aplicación con su sistema operativo configurado en modo oscuro
- **THEN** la aplicación se muestra con el tema oscuro

#### Scenario: Primera visita con el sistema en claro

- **WHEN** una persona que nunca ha elegido tema abre la aplicación con su sistema operativo en modo claro o sin preferencia declarada
- **THEN** la aplicación se muestra con el tema claro

#### Scenario: El sistema cambia de preferencia sin elección manual

- **WHEN** la persona no ha elegido tema manualmente y cambia la preferencia de su sistema operativo mientras la aplicación está abierta
- **THEN** la aplicación adopta el tema que corresponde a la nueva preferencia del sistema, sin recargar

### Requirement: La persona alterna el tema desde la cabecera

La cabecera del armazón MUST ofrecer un control accesible para alternar entre el tema claro y el oscuro, visible en todas las pantallas autenticadas. El control MUST indicar de forma perceptible qué tema está activo o cuál se activará al usarlo, y MUST ser operable con teclado y anunciado correctamente por tecnologías de asistencia.

#### Scenario: Alternar el tema

- **WHEN** una persona autenticada activa el control de tema de la cabecera
- **THEN** la aplicación cambia al otro tema de inmediato, sin recargar la página, y el cambio alcanza a toda la interfaz a la vez y no solo a la pantalla actual

#### Scenario: El control es accesible

- **WHEN** una persona navega con teclado o con un lector de pantalla
- **THEN** puede enfocar y activar el control de tema y percibe qué acción realiza y qué tema queda activo

### Requirement: Una elección manual se recuerda y prevalece

Cuando la persona alterna el tema manualmente, la aplicación MUST guardar esa elección en el almacenamiento local del navegador y MUST aplicarla en las visitas siguientes con preferencia sobre la preferencia del sistema operativo. Mientras exista una elección manual guardada, un cambio en la preferencia del sistema MUST NOT alterar el tema. La preferencia MUST NOT enviarse al backend ni almacenarse en la cuenta de la persona.

#### Scenario: La elección sobrevive a la recarga

- **WHEN** una persona elige un tema y más tarde vuelve a abrir la aplicación en el mismo navegador
- **THEN** la aplicación se muestra con el tema que eligió, aunque no coincida con la preferencia de su sistema operativo

#### Scenario: La elección manual gana a la preferencia del sistema

- **WHEN** existe una elección manual guardada y la preferencia del sistema operativo indica el tema contrario
- **THEN** la aplicación se muestra con el tema elegido manualmente

#### Scenario: El almacenamiento local no está disponible

- **WHEN** el navegador impide leer o escribir el almacenamiento local
- **THEN** la aplicación sigue funcionando y permite alternar el tema durante la sesión, aunque la elección no sobreviva a la recarga

#### Scenario: La preferencia no viaja al servidor

- **WHEN** la persona alterna el tema
- **THEN** no se realiza ninguna petición al backend a causa de ese cambio y la preferencia solo queda en el navegador
