# Guía para evaluadores — Frontend y consultas SQL

Este documento acompaña al código y a los otros documentos de `docs/`. Su
objetivo es explicar **dos temas que suelen requerir contexto**:

1. Cómo está construido el frontend y dónde se cumple cada requisito técnico
   (empezando por qué es un "componente" y cómo se organizan).
2. Qué hace cada tipo de sentencia SQL usada en las 10 consultas de
   inteligencia de negocio (`WITH`, `UNION ALL`, `FILTER`, funciones de
   ventana, etc.) y por qué se eligió.

No sustituye a [`api.md`](api.md) ni a [`consultas-negocio.md`](consultas-negocio.md);
los complementa.

---

# Parte 1 — Frontend

## 1.1 Qué es un componente

En React la interfaz se describe como **una función del estado**: dado un
estado, siempre se pinta la misma pantalla. La unidad de esa función es el
**componente**: una función de JavaScript que

- recibe datos de entrada llamados **props** (por ejemplo, `<ItemTarea tarea={t} />`),
- puede tener **estado interno** propio (con el hook `useState`),
- y **devuelve JSX**, una descripción declarativa de lo que debe verse.

React se encarga de volver a llamar a esa función cuando su estado o sus props
cambian, y de actualizar el DOM real solo en lo que haya cambiado. El
desarrollador nunca manipula el DOM a mano.

### Tipos de componente en este proyecto

Los componentes de `frontend/src/componentes/` se agrupan por responsabilidad:

| Grupo | Carpeta | Ejemplos | Rol |
|---|---|---|---|
| **Presentación** | `Comunes/`, hojas de `Tarea/` y `Categoria/` | `ItemTarea`, `Cargando`, `MensajeError` | Reciben datos por props y los dibujan. No saben de dónde vienen |
| **Pantalla / contenedor** | `Tarea/`, `Categoria/` | `ListaTareas`, `ListaCategorias` | Piden datos a un hook, gestionan la interacción y componen los de presentación |
| **Estructura (layout)** | `Layout/` | `Layout`, `Header`, `Sidebar` | Marco visual común: cabecera, navegación lateral, zona de contenido |
| **Control de flujo** | `Comunes/` | `RutaProtegida`, `LimiteDeError` | No pintan UI propia; deciden **si** se renderiza lo que envuelven |
| **Proveedor de contexto** | `contexto/` | `ProveedorAuth` | Expone estado (la sesión) a todo su subárbol sin pasarlo por props |

### Árbol de render (de fuera hacia dentro)

```
main.jsx
└─ <BrowserRouter>          enrutado por URL
   └─ <ProveedorAuth>       estado de sesión disponible para todos los hijos
      └─ <LimiteDeError>    Error Boundary: captura errores de render del árbol
         └─ <App>           define las rutas
            └─ <RutaProtegida>   deja pasar solo con sesión válida
               └─ <Layout>       Header + Sidebar + contenido
                  └─ <ListaTareas>  pantalla: usa useTareas(), pinta <ItemTarea>
```

### Regla de diseño: un componente no habla con la red

Ningún componente hace `fetch` ni importa un cliente HTTP. La comunicación con
la API vive **solo** en `servicios/api.js`, y los componentes la consumen
**solo** a través de hooks personalizados (`useTareas`, `useCategorias`,
`useEtiquetas`, `useAuth`). Esto mantiene los componentes centrados en la
presentación y concentra en un punto el manejo de errores, el token y los
formatos.

---

## 1.2 Los ocho requisitos técnicos, uno a uno

### 1. React Hooks (`useState`, `useEffect`, `useContext`)

| Hook | Para qué | Dónde verlo |
|---|---|---|
| `useState` | Estado local de un componente o hook (lista de tareas, "cargando", error de un campo) | Todos los hooks y componentes con estado, p. ej. `ItemTarea.jsx` (`procesando`, `error`) |
| `useEffect` | Efectos secundarios: cargar datos al montar, volver a cargar cuando cambian los filtros, suscribirse al evento de sesión caducada | `useTareas.js` (recarga al cambiar filtros), `ContextoAuth.jsx` (revalidación del token al arrancar) |
| `useContext` | Leer el estado de sesión desde cualquier componente sin recibirlo por props | `hooks/useAuth.js` — único punto que hace `useContext(ContextoAuth)` |

También se usan hooks de afinado (`useCallback`, `useMemo`, `useRef`,
`useLayoutEffect`, `useId`) donde aportan algo concreto; están comentados en el
código explicando por qué.

### 2. Hooks personalizados para las llamadas a la API

Cada recurso tiene su hook, y es la **única puerta** de la interfaz a ese
grupo de endpoints:

| Hook | Endpoints | Responsabilidad |
|---|---|---|
| `useTareas(filtros)` | `GET/POST/PUT/DELETE /api/tareas`, `PATCH .../completar` | Carga la lista, la vuelve a pedir cuando cambian los filtros (comparación estable, no por identidad de objeto), descarta respuestas que llegan tarde (contador de secuencia), expone `crear/editar/eliminar/cambiarCompletada` |
| `useCategorias()` | `GET/POST/PUT/DELETE /api/categorias` | Igual patrón para categorías |
| `useEtiquetas()` | `GET/POST /api/etiquetas` | Soporte del autocompletar y del multi-selector del filtro |
| `useAuth()` | — | Acceso al contexto de sesión |

Cada hook devuelve siempre la misma forma: `{ datos, cargando, error, ...acciones }`.
Los componentes no necesitan saber nada de HTTP.

### 3. Context API para el estado de autenticación

`contexto/ContextoAuth.jsx` define `ProveedorAuth`, que centraliza:

- El **token** JWT: se lee de `localStorage` una sola vez al iniciar y se
  guarda ahí al iniciar sesión. La clave de almacenamiento está definida en un
  único sitio; ningún componente lee el token del navegador por su cuenta.
- El **usuario** autenticado y un flag `cargandoSesion` mientras se revalida
  el token guardado contra `GET /api/auth/perfil` (un token guardado no se da
  por bueno hasta que la API lo confirma).
- Las acciones `iniciarSesion`, `registrar`, `cerrarSesion`.
- El **cierre centralizado por `401`**: `servicios/api.js` avisa al contexto
  cuando cualquier petición protegida recibe un 401; el contexto vacía la
  sesión y el guardián de rutas redirige solo.

El valor del contexto se memoiza (`useMemo`) para no re-renderizar a los
consumidores en cada render del proveedor.

### 4. Error Boundaries

`componentes/Comunes/LimiteDeError.jsx` es un componente de clase con
`getDerivedStateFromError` + `componentDidCatch` (la única forma que React
ofrece de capturar errores de render). Envuelve `<App />` en `main.jsx`, de
modo que un fallo de render en cualquier pantalla muestra una pantalla de
error controlada en lugar de un árbol en blanco.

> Nota: un Error Boundary captura errores **de render**, no errores
> asíncronos de las llamadas a la API. Esos se manejan en los hooks
> (`error` en el estado) y se pintan con `<MensajeError>` y botones de
> "Reintentar".

### 5. CSS Modules

Todos los estilos están en archivos `*.module.css` junto a su componente
(`ItemTarea.module.css` al lado de `ItemTarea.jsx`). Los estilos compartidos
por los dos formularios de autenticación viven en
`estilos/formulario.module.css` y se componen con `composes`. No hay
`styled-components`, Tailwind ni Bootstrap: `frontend/package.json` solo
declara `react`, `react-dom` y `react-router-dom`.

Con CSS Modules cada clase se renombra a un identificador único en build, así
que no hay colisiones de nombres entre componentes.

### 6. Indicadores de carga

- Componente dedicado `Comunes/Cargando.jsx`.
- Cada hook expone `cargando`; las pantallas lo usan para mostrar `<Cargando>`
  en la carga inicial y para deshabilitar botones mientras una acción está en
  vuelo (`ItemTarea.jsx` deshabilita el checkbox con el flag `procesando`).
- La restauración de sesión tiene su propio `cargandoSesion`: si no había
  token guardado, la app sabe desde el primer render que no hay sesión y **no
  pinta** un spinner innecesario.

### 7. Validación de formularios

`servicios/validacion.js` valida en cliente **presencia, forma del email y
longitud de la contraseña** (esta última contada en bytes UTF-8, igual que el
backend, porque una letra acentuada ocupa dos).

La validación de cliente es deliberadamente mínima: existe para dar respuesta
inmediata y ahorrar un viaje, **no** para duplicar las reglas de negocio (una
segunda copia se desincroniza en cuanto cambie una de las dos). La autoridad
es la API. Los errores por campo del `400 DATOS_INVALIDOS` llegan con la misma
forma `{ campo: motivo }` que devuelve la validación local, así que los
formularios pintan ambos con una única estructura.

### 8. Actualizaciones optimistas "cuando sea apropiado"

El requisito incluye la condición **"cuando sea apropiado"**, y la decisión de
diseño fue:

**No se hacen actualizaciones optimistas en la lista de tareas.** El listado
se filtra, ordena y busca **en el servidor**. Tras crear o editar una tarea el
cliente no puede predecir de forma fiable el resultado: la tarea nueva podría
no encajar con el filtro activo, su posición en el orden depende de datos del
servidor (`busqueda_tsv`, prioridad como enum, fechas), y una etiqueta o
categoría podría haber sido rechazada. Un insert optimista mostraría a menudo
un estado que la siguiente carga contradice. Por eso `useTareas` usa
**reconciliación tras éxito**: la acción espera la respuesta, y solo si va bien
vuelve a pedir la lista al servidor (`recargar`). El error de una acción se
propaga con `throw` para que el formulario lo muestre.

**Sí se aplica la actualización local donde es seguro y barato:**
`useEtiquetas.crear` inserta la etiqueta recién creada en la lista en memoria,
ya ordenada por nombre, **sin recargar** — una etiqueta es un objeto plano
`{ id, nombre }` sin filtros ni orden dependientes del servidor, así que el
estado local no puede quedar mal.

Es, por tanto, una decisión consciente sobre dónde la actualización optimista
aporta y dónde introduce inconsistencias.

---

# Parte 2 — Consultas SQL: qué hace cada sentencia

Las 10 consultas están en [`consultas-negocio.md`](consultas-negocio.md) con
su SQL completo y su salida esperada. Esta sección explica **las
construcciones** que aparecen, para quien quiera entender el porqué de cada
una. Se ejecutan directamente contra PostgreSQL (SQL Editor de Supabase o
`psql`), no a través de la API.

## 2.1 `WITH ... AS (...)` — Common Table Expression (CTE)

**Qué es.** Una subconsulta con nombre que se define antes del `SELECT`
principal y se usa como si fuera una tabla. Sirve para **partir una consulta
compleja en pasos legibles**.

```sql
WITH periodos AS (
  SELECT 'ultimos_30_dias' AS periodo, COUNT(*) AS tareas_creadas
  FROM tareas WHERE creado_en >= NOW() - INTERVAL '30 days'
)
SELECT * FROM periodos;
```

**Dónde y por qué:**

- **Consulta 1** (participación de usuarios): dos CTE, `periodos` (tareas por
  ventana) y `total_usuarios` (denominador), combinadas al final. Sin CTE
  habría que repetir la cuenta de usuarios en cada fila.
- **Consulta 7** (retención): una CTE `actividad_semanal` que etiqueta cada
  par (usuario, semana). En **7b** esa misma CTE se **une consigo misma** para
  comparar semana N con semana N+1 — sería ilegible como subconsultas
  anidadas.
- **Consulta 10** (benchmarking): `tasa_por_usuario` calcula la tasa de cada
  usuario y `umbral` calcula el percentil 90 de esas tasas. El `SELECT` final
  filtra por ese umbral.

## 2.2 `UNION ALL`

**Qué es.** Apila los resultados de dos consultas con las mismas columnas, una
debajo de la otra. `UNION ALL` **no elimina duplicados** (más rápido y, aquí,
correcto: las filas ya son distintas por diseño). `UNION` a secas sí los
eliminaría.

```sql
SELECT 'creacion'   AS evento, ... FROM tareas
UNION ALL
SELECT 'completado' AS evento, ... FROM tareas WHERE completada_en IS NOT NULL
```

**Dónde y por qué:**

- **Consulta 4** (horas pico): una rama cuenta por hora de **creación**, la
  otra por hora de **completado**; `UNION ALL` las presenta juntas con una
  columna `evento` que las distingue.
- **Consulta 1**: apila la fila de "últimos 30 días" y la de "30 días
  anteriores" en una sola tabla de dos filas.

## 2.3 `COUNT(*) FILTER (WHERE ...)` — agregado condicional

**Qué es.** Aplica un filtro **solo a ese agregado**, sin afectar al resto de
la consulta. Es la forma estándar SQL de "cuenta cuántas cumplen X mientras
sigo viendo el total".

```sql
COUNT(*)                                   AS total_tareas,
COUNT(*) FILTER (WHERE estado = 'completada') AS completadas
```

**Dónde y por qué:** consultas **2, 3, 6, 9 y 10**. En todas se necesita, en
la misma fila, el total y el subconjunto "completadas" para calcular una tasa.
La alternativa clásica (`SUM(CASE WHEN ... THEN 1 ELSE 0 END)`) hace lo mismo
pero se lee peor.

## 2.4 Funciones de ventana: `... OVER (...)`

**Qué es.** Un cálculo que mira **varias filas relacionadas** sin colapsarlas
en una (a diferencia de un `GROUP BY`). `SUM(COUNT(*)) OVER ()` calcula un
total general que luego se usa como denominador en cada fila.

```sql
ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER (), 2) AS proporcion
```

**Dónde y por qué:** **consulta 8** (distribución de prioridad). Se quiere,
para cada prioridad, `total_tareas` y también qué **proporción** representa
sobre el total del grupo. La ventana `OVER ()` da ese total sin una segunda
consulta ni un `CROSS JOIN`.

## 2.5 `PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY ...)`

**Qué es.** Un agregado ordenado que devuelve el **percentil** de una
distribución (aquí, el valor que deja por debajo al 90 % de los usuarios).
`_CONT` interpola entre valores; existe también `_DISC` (discreto).

**Dónde y por qué:** **consulta 10**. El reto pide "el 10 % superior por tasa
de completado". En vez de un `LIMIT` fijo (que sería incorrecto si cambia el
número de usuarios), se calcula el umbral real de la distribución y se filtra
`WHERE tasa >= p90`. Así el criterio se adapta al tamaño de la base de
usuarios y queda **documentado**, no implícito.

## 2.6 `JOIN`, `LEFT JOIN`, `CROSS JOIN`

| Tipo | Qué hace | Dónde |
|---|---|---|
| `JOIN` (interno) | Solo filas con pareja en ambas tablas | Consulta 6 (etiquetas que **sí** se han usado), consulta 8 (tareas de usuarios con login) |
| `LEFT JOIN` | Todas las filas de la izquierda; `NULL` si no hay pareja | Consulta 3 (**todas** las categorías, incluso con 0 tareas), consulta 5 (categoría opcional de la tarea), consulta 7b (auto-unión: un usuario puede no estar en la semana siguiente) |
| `CROSS JOIN` | Producto cartesiano: cada fila de A con cada fila de B | Consultas 1 y 10, para pegar un valor escalar (total de usuarios, umbral p90) a cada fila sin condición de unión |

El uso de `LEFT JOIN` en la consulta 3 es intencional: una categoría sin
tareas debe aparecer con tasa `NULL`, no desaparecer del informe.

## 2.7 Fechas y tiempo

| Construcción | Qué hace | Dónde |
|---|---|---|
| `NOW() - INTERVAL '30 days'` | Punto de corte relativo a ahora | Ventanas temporales en 1, 2, 7, 8, 9 |
| `columna::date` | Trunca un `timestamptz` a día (quita la hora) | Consulta 2 (agrupar por día), consulta 3 (días entre creación y completado) |
| `date_trunc('month', creado_en)` | Lleva cada fecha al primer día de su mes | Consulta 9 (serie mensual del último año) |
| `EXTRACT(DOW FROM ...)` | Día de la semana (0 = domingo … 6 = sábado, convención PostgreSQL) | Consulta 4 |
| `EXTRACT(HOUR FROM ...)` | Hora del día (0–23) | Consulta 4 |

La consulta 4 documenta explícitamente la convención de `DOW` porque "día de
la semana" es ambiguo entre sistemas.

## 2.8 Divisiones seguras: `NULLIF`, `::numeric`, `ROUND`

```sql
ROUND( completadas::numeric / NULLIF(total, 0), 2 )
```

- `NULLIF(total, 0)` convierte un denominador 0 en `NULL`, evitando el error
  *division by zero*; el resultado sale `NULL` en vez de romper la consulta.
- `::numeric` fuerza división **decimal**: sin él, `entero / entero` en SQL da
  un entero (`3/4 = 0`).
- `ROUND(x, 2)` deja el resultado a dos decimales para el informe.

Este patrón aparece en **casi todas** las consultas que calculan una tasa o
proporción (2, 3, 6, 7b, 8, 10).

## 2.9 `GROUP BY` + `HAVING COUNT(DISTINCT ...)`

**Qué es.** `GROUP BY` colapsa filas por una clave; `HAVING` filtra **esos
grupos** (a diferencia de `WHERE`, que filtra filas antes de agrupar).
`COUNT(DISTINCT semana) = 4` significa "presente en las 4 semanas distintas".

**Dónde y por qué:** **consulta 7a** (usuarios activos las 4 semanas
seguidas). Se agrupa por usuario y se conserva solo a quien aparece en las 4
ventanas semanales.

---

## Resumen: qué construcción usa cada consulta

| # | Tema | Construcciones destacadas |
|---|---|---|
| 1 | Participación de usuarios | `WITH`, `UNION ALL`, `CROSS JOIN`, `NULLIF` |
| 2 | Tasa de completado diaria por prioridad | `FILTER`, `::date`, `GROUP BY` |
| 3 | Rendimiento por categoría | `LEFT JOIN`, `FILTER`, `AVG(...) FILTER`, `NULLIF` |
| 4 | Horas y días pico | `UNION ALL`, `EXTRACT(DOW/HOUR)`, `GROUP BY` |
| 5 | Tareas vencidas | `JOIN` + `LEFT JOIN`, `AVG`, aritmética de fechas |
| 6 | Etiquetas más usadas | `JOIN`, `FILTER`, `NULLIF` |
| 7 | Retención de usuarios | `WITH` reutilizada, auto-`LEFT JOIN`, `HAVING COUNT(DISTINCT)` |
| 8 | Distribución de prioridad | Función de ventana `SUM(...) OVER ()`, `JOIN` |
| 9 | Tendencias estacionales | `date_trunc`, `FILTER` |
| 10 | Benchmarking top 10 % | `WITH` (2 CTE), `PERCENTILE_CONT`, subconsulta correlacionada |
