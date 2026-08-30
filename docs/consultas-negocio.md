# Consultas de Inteligencia de Negocio — Lista de Tareas

Estas consultas se ejecutan directamente contra PostgreSQL (SQL Editor de
Supabase o `psql`), no a través de la API de la aplicación. Cada una asume
el esquema de `schema.sql` y se probó contra los datos de `seed.sql`.

Varias preguntas del reto son abiertas por diseño (no dan una definición
exacta de "tasa", "pico" o "activo"); cada consulta deja explícito qué
definición se usó, para que el criterio quede documentado y no implícito.

---

## 1. Participación de usuarios: promedio de tareas creadas, últimos 30 días vs. los 30 anteriores

**Definición usada:** promedio = total de tareas creadas en el período ÷
total de usuarios registrados (incluye usuarios con 0 tareas en ese
período, no solo los que crearon alguna).

```sql
WITH periodos AS (
  SELECT 'ultimos_30_dias' AS periodo, COUNT(*) AS tareas_creadas
  FROM tareas
  WHERE creado_en >= NOW() - INTERVAL '30 days'
  UNION ALL
  SELECT '30_dias_anteriores', COUNT(*)
  FROM tareas
  WHERE creado_en >= NOW() - INTERVAL '60 days'
    AND creado_en <  NOW() - INTERVAL '30 days'
),
total_usuarios AS (
  SELECT COUNT(*) AS n FROM usuarios
)
SELECT
  p.periodo,
  p.tareas_creadas,
  ROUND(p.tareas_creadas::numeric / NULLIF(t.n, 0), 2) AS promedio_por_usuario
FROM periodos p CROSS JOIN total_usuarios t
ORDER BY p.periodo DESC;
```

**Formato de salida esperado** (resultado real contra el seed):

| periodo | tareas_creadas | promedio_por_usuario |
|---|---|---|
| ultimos_30_dias | 377 | 47.13 |
| 30_dias_anteriores | 287 | 35.88 |

**Nota de rendimiento:** filtra por `creado_en`, columna sin índice propio
en el esquema actual (los índices existentes llevan `usuario_id` como
primera columna). A este volumen no es un problema; si la tabla creciera
mucho, valdría la pena un índice adicional sobre `creado_en`.

---

## 2. Tasa de completado diaria, últimos 90 días, por prioridad

**Definición usada:** para cada día y prioridad, tasa = tareas creadas ese
día que ya están en estado `completada` ÷ total de tareas creadas ese día
(agrupado por fecha de creación, no de vencimiento).

```sql
SELECT
  creado_en::date AS dia,
  prioridad,
  COUNT(*) AS total_tareas,
  COUNT(*) FILTER (WHERE estado = 'completada') AS completadas,
  ROUND(
    COUNT(*) FILTER (WHERE estado = 'completada')::numeric / COUNT(*), 2
  ) AS tasa_completado
FROM tareas
WHERE creado_en >= NOW() - INTERVAL '90 days'
GROUP BY dia, prioridad
ORDER BY dia DESC, prioridad;
```

**Formato de salida esperado** (resultado real contra el seed — la
consulta devuelve hasta 270 filas posibles en 90 días × 3 prioridades;
el SQL Editor de Supabase limita la grilla a 100 filas por defecto,
aumenta el límite si quieres ver el resultado completo):

| dia | prioridad | total_tareas | completadas | tasa_completado |
|---|---|---|---|---|
| 2026-08-29 | alta | 4 | 3 | 0.75 |
| 2026-08-29 | baja | 3 | 1 | 0.33 |
| 2026-08-29 | media | 4 | 1 | 0.25 |
| 2026-08-28 | alta | 3 | 1 | 0.33 |
| 2026-08-28 | baja | 5 | 2 | 0.40 |
| 2026-08-17 | media | 10 | 6 | 0.60 |
| 2026-08-07 | media | 10 | 8 | 0.80 |

**Nota sobre los resultados:** con este volumen de datos, las tasas
salen con variedad real (de 0.00 a 1.00, pasando por valores intermedios
como 0.33, 0.60, 0.75), a diferencia de la primera versión del seed
donde casi todo salía en 0% o 100% por falta de muestra por día.

---

## 3. Rendimiento por categoría: tasa de completado y tiempo promedio de completado

```sql
SELECT
  c.id AS categoria_id,
  c.nombre AS categoria,
  COUNT(t.id) AS total_tareas,
  COUNT(t.id) FILTER (WHERE t.estado = 'completada') AS completadas,
  ROUND(
    COUNT(t.id) FILTER (WHERE t.estado = 'completada')::numeric
      / NULLIF(COUNT(t.id), 0), 2
  ) AS tasa_completado,
  ROUND(
    AVG(t.completada_en::date - t.creado_en::date)
      FILTER (WHERE t.estado = 'completada'), 1
  ) AS dias_promedio_completado
FROM categorias c
LEFT JOIN tareas t ON t.categoria_id = c.id
GROUP BY c.id, c.nombre
ORDER BY tasa_completado DESC;
```

**Formato de salida esperado** (primeras filas = mejor rendimiento,
últimas = peor; resultado real contra el seed):

| categoria_id | categoria | total_tareas | completadas | tasa_completado | dias_promedio_completado |
|---|---|---|---|---|---|
| 19 | Proyectos | 44 | 42 | 0.95 | 10.2 |
| 20 | Personal | 29 | 26 | 0.90 | 8.7 |
| 18 | Trabajo | 46 | 41 | 0.89 | 8.8 |
| 6 | Personal | 70 | 37 | 0.53 | 8.0 |
| 14 | Finanzas | 69 | 29 | 0.42 | 7.6 |
| 16 | Ocio | 41 | 7 | 0.17 | 11.3 |

---

## 4. Patrones de productividad: horas pico y días de la semana

**Definición usada:** `dia_semana` sigue la convención de PostgreSQL
(`EXTRACT(DOW ...)`: 0 = domingo … 6 = sábado). Se listan ambos eventos
(creación y completado) ordenados por volumen para identificar los picos
de un vistazo.

```sql
SELECT 'creacion' AS evento,
       EXTRACT(DOW FROM creado_en)::int AS dia_semana,
       EXTRACT(HOUR FROM creado_en)::int AS hora,
       COUNT(*) AS total
FROM tareas
GROUP BY dia_semana, hora

UNION ALL

SELECT 'completado',
       EXTRACT(DOW FROM completada_en)::int AS dia_semana,
       EXTRACT(HOUR FROM completada_en)::int AS hora,
       COUNT(*) AS total
FROM tareas
WHERE completada_en IS NOT NULL
GROUP BY dia_semana, hora

ORDER BY evento, total DESC;
```

**Formato de salida esperado** (resultado real contra el seed, tras
aplicar `fix-hora-aleatoria.sql`):

| evento | dia_semana | hora | total |
|---|---|---|---|
| completado | 6 | 16 | 13 |
| completado | 0 | 19 | 10 |
| completado | 6 | 13 | 10 |
| completado | 6 | 4 | 9 |
| completado | 5 | 7 | 9 |
| completado | 4 | 4 | 8 |
| completado | 4 | 8 | 8 |
| completado | 6 | 9 | 8 |
| completado | 1 | 11 | 8 |

**Nota sobre este resultado:** ya no hay una hora fija repetida — la
corrección funcionó. El pico visible es sábado (`dia_semana = 6`) a las
16h, con 13 tareas completadas. Como `'completado'` ordena
alfabéticamente antes que `'creacion'`, el límite de 100 filas de la
grilla de Supabase se agota mostrando solo eventos de completado; para
ver también los de creación, sube el límite de filas en el SQL Editor o
filtra la consulta por `evento = 'creacion'` por separado.

---

## 5. Tareas vencidas: por usuario y categoría, con promedio de días vencidas

```sql
SELECT
  u.id AS usuario_id,
  u.email,
  c.nombre AS categoria,
  COUNT(t.id) AS tareas_vencidas,
  ROUND(AVG(CURRENT_DATE - t.fecha_vencimiento), 1) AS dias_promedio_vencida
FROM tareas t
JOIN usuarios u ON u.id = t.usuario_id
LEFT JOIN categorias c ON c.id = t.categoria_id
WHERE t.estado <> 'completada'
  AND t.fecha_vencimiento IS NOT NULL
  AND t.fecha_vencimiento < CURRENT_DATE
GROUP BY u.id, u.email, c.nombre
ORDER BY tareas_vencidas DESC;
```

**Formato de salida esperado** (resultado real contra el seed):

| usuario_id | email | categoria | tareas_vencidas | dias_promedio_vencida |
|---|---|---|---|---|
| 5 | elena@correo.com | Salud | 29 | 109.6 |
| 6 | felipe@correo.com | Finanzas | 28 | 82.6 |
| 3 | carla@correo.com | Salud | 26 | 70.5 |
| 8 | hugo@correo.com | Trabajo | 2 | 10.5 |
| 8 | hugo@correo.com | Proyectos | 1 | 62.0 |

---

## 6. Etiquetas más usadas y su tasa de completado

```sql
SELECT
  e.id AS etiqueta_id,
  e.nombre AS etiqueta,
  COUNT(te.tarea_id) AS veces_usada,
  COUNT(t.id) FILTER (WHERE t.estado = 'completada') AS tareas_completadas,
  ROUND(
    COUNT(t.id) FILTER (WHERE t.estado = 'completada')::numeric
      / NULLIF(COUNT(te.tarea_id), 0), 2
  ) AS tasa_completado
FROM etiquetas e
JOIN tarea_etiquetas te ON te.etiqueta_id = e.id
JOIN tareas t ON t.id = te.tarea_id
GROUP BY e.id, e.nombre
ORDER BY veces_usada DESC, tasa_completado DESC;
```

**Formato de salida esperado** (resultado real contra el seed):

| etiqueta_id | etiqueta | veces_usada | tareas_completadas | tasa_completado |
|---|---|---|---|---|
| 7 | urgente | 80 | 44 | 0.55 |
| 4 | bloqueado | 73 | 56 | 0.77 |
| 18 | urgente | 70 | 64 | 0.91 |
| 11 | delegado | 66 | 11 | 0.17 |
| 1 | bloqueado | 33 | 29 | 0.88 |

---

## 7. Retención de usuarios: actividad en las últimas 4 semanas

**Definición usada:** "activo en una semana" = creó al menos una tarea en
esa ventana de 7 días. Semana 1 = la más antigua de las 4 (hace 28-21
días), semana 4 = la más reciente (últimos 7 días) — numeración
ascendente en el tiempo, para que la retención semana→semana avance hacia
adelante.

```sql
WITH actividad_semanal AS (
  SELECT DISTINCT
    usuario_id,
    CASE
      WHEN creado_en >= NOW() - INTERVAL '28 days'
       AND creado_en <  NOW() - INTERVAL '21 days' THEN 1
      WHEN creado_en >= NOW() - INTERVAL '21 days'
       AND creado_en <  NOW() - INTERVAL '14 days' THEN 2
      WHEN creado_en >= NOW() - INTERVAL '14 days'
       AND creado_en <  NOW() - INTERVAL '7 days'  THEN 3
      WHEN creado_en >= NOW() - INTERVAL '7 days'                        THEN 4
    END AS semana
  FROM tareas
  WHERE creado_en >= NOW() - INTERVAL '28 days'
)
-- 7a. Usuarios activos las 4 semanas seguidas
SELECT usuario_id
FROM actividad_semanal
WHERE semana IS NOT NULL
GROUP BY usuario_id
HAVING COUNT(DISTINCT semana) = 4;
```

```sql
-- 7b. Retención semana a semana (misma CTE, reutilizada)
WITH actividad_semanal AS (
  SELECT DISTINCT
    usuario_id,
    CASE
      WHEN creado_en >= NOW() - INTERVAL '28 days'
       AND creado_en <  NOW() - INTERVAL '21 days' THEN 1
      WHEN creado_en >= NOW() - INTERVAL '21 days'
       AND creado_en <  NOW() - INTERVAL '14 days' THEN 2
      WHEN creado_en >= NOW() - INTERVAL '14 days'
       AND creado_en <  NOW() - INTERVAL '7 days'  THEN 3
      WHEN creado_en >= NOW() - INTERVAL '7 days'                        THEN 4
    END AS semana
  FROM tareas
  WHERE creado_en >= NOW() - INTERVAL '28 days'
)
SELECT
  a1.semana AS semana_origen,
  a1.semana + 1 AS semana_siguiente,
  COUNT(DISTINCT a1.usuario_id) AS usuarios_semana_origen,
  COUNT(DISTINCT a2.usuario_id) AS retenidos_semana_siguiente,
  ROUND(
    COUNT(DISTINCT a2.usuario_id)::numeric
      / NULLIF(COUNT(DISTINCT a1.usuario_id), 0), 2
  ) AS tasa_retencion
FROM actividad_semanal a1
LEFT JOIN actividad_semanal a2
  ON a2.usuario_id = a1.usuario_id AND a2.semana = a1.semana + 1
WHERE a1.semana < 4
GROUP BY a1.semana
ORDER BY a1.semana;
```

**Formato de salida esperado (7a)** (resultado real contra el seed):

| usuario_id |
|---|
| 1 |
| 2 |
| 3 |
| 4 |
| 5 |
| 6 |
| 7 |
| 8 |

**Formato de salida esperado (7b)** (resultado real contra el seed):

| semana_origen | semana_siguiente | usuarios_semana_origen | retenidos_semana_siguiente | tasa_retencion |
|---|---|---|---|---|
| 1 | 2 | 8 | 8 | 1.00 |
| 2 | 3 | 8 | 8 | 1.00 |
| 3 | 4 | 8 | 8 | 1.00 |

**Nota sobre este resultado:** los 8 usuarios del seed salen retenidos al
100% las 4 semanas — esto es deliberado, no un error: el generador de
datos garantiza al menos una tarea por usuario en cada una de las últimas
4 semanas, precisamente para poder demostrar que la consulta detecta
correctamente el caso de retención perfecta. En datos de producción
reales, es normal y esperable que esta tasa sea menor a 100%; la consulta
está preparada para reflejar eso tal como está escrita, sin cambios.

---

## 8. Distribución de prioridad para usuarios activos (login en los últimos 7 días)

```sql
SELECT
  t.prioridad,
  COUNT(*) AS total_tareas,
  ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER (), 2) AS proporcion
FROM tareas t
JOIN usuarios u ON u.id = t.usuario_id
WHERE u.ultimo_login >= NOW() - INTERVAL '7 days'
GROUP BY t.prioridad
ORDER BY t.prioridad;
```

**Formato de salida esperado:**

| prioridad | total_tareas | proporcion |
|---|---|---|
| alta | 239 | 0.32 |
| baja | 207 | 0.28 |
| media | 295 | 0.40 |

---

## 9. Tendencias estacionales: creación y completado por mes, último año

```sql
SELECT
  date_trunc('month', creado_en)::date AS mes,
  COUNT(*) AS tareas_creadas,
  COUNT(*) FILTER (WHERE estado = 'completada') AS tareas_completadas
FROM tareas
WHERE creado_en >= NOW() - INTERVAL '12 months'
GROUP BY mes
ORDER BY mes;
```

**Formato de salida esperado** (resultado real contra el seed):

| mes | tareas_creadas | tareas_completadas |
|---|---|---|
| 2025-08-01 | 1 | 1 |
| 2025-09-01 | 22 | 13 |
| 2025-11-01 | 25 | 17 |
| 2026-02-01 | 10 | 9 |
| 2026-05-01 | 14 | 5 |
| 2026-06-01 | 314 | 200 |
| 2026-07-01 | 299 | 182 |
| 2026-08-01 | 365 | 215 |

**Nota sobre este resultado:** hay un salto muy marcado entre abril 2026
(25 tareas) y junio 2026 (314 tareas). No representa una tendencia
estacional real: es un artefacto deliberado del diseño del seed, que
concentra a propósito mucha más densidad de datos dentro de los últimos
90 días (para que la pregunta 2 tuviera suficiente volumen diario) que en
el historial más antiguo. La consulta en sí es correcta; el patrón que
muestra es del conjunto de prueba, no una estacionalidad de negocio real.
Con datos de producción reales, esta misma consulta mostraría variación
mes a mes más gradual.

---

## 10. Benchmarking: usuarios en el 10% superior por tasa de completado

**Definición usada:** el 10% superior se calcula con `PERCENTILE_CONT`
sobre la distribución real de tasas de completado por usuario (no un
`LIMIT` fijo), para que el umbral se ajuste al tamaño real de la base de
usuarios. "Tareas que maneja simultáneamente" = tareas que no están en
estado `completada` en este momento (carga abierta actual).

```sql
WITH tasa_por_usuario AS (
  SELECT
    u.id AS usuario_id,
    u.email,
    COUNT(t.id) AS total_tareas,
    COUNT(t.id) FILTER (WHERE t.estado = 'completada') AS completadas,
    ROUND(
      COUNT(t.id) FILTER (WHERE t.estado = 'completada')::numeric
        / NULLIF(COUNT(t.id), 0), 2
    ) AS tasa_completado
  FROM usuarios u
  JOIN tareas t ON t.usuario_id = u.id
  GROUP BY u.id, u.email
),
umbral AS (
  SELECT PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY tasa_completado) AS p90
  FROM tasa_por_usuario
)
SELECT
  tpu.usuario_id,
  tpu.email,
  tpu.tasa_completado,
  tpu.total_tareas,
  (
    SELECT COUNT(*) FROM tareas t2
    WHERE t2.usuario_id = tpu.usuario_id AND t2.estado <> 'completada'
  ) AS tareas_abiertas_actualmente
FROM tasa_por_usuario tpu, umbral
WHERE tpu.tasa_completado >= umbral.p90
ORDER BY tpu.tasa_completado DESC;
```

```sql
-- Promedio de carga simultánea entre ese grupo top 10%
WITH tasa_por_usuario AS (
  SELECT
    u.id AS usuario_id,
    COUNT(t.id) FILTER (WHERE t.estado = 'completada')::numeric
      / NULLIF(COUNT(t.id), 0) AS tasa_completado
  FROM usuarios u
  JOIN tareas t ON t.usuario_id = u.id
  GROUP BY u.id
),
umbral AS (
  SELECT PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY tasa_completado) AS p90
  FROM tasa_por_usuario
)
SELECT ROUND(AVG(abiertas), 1) AS promedio_tareas_simultaneas_top10
FROM (
  SELECT
    (
      SELECT COUNT(*) FROM tareas t2
      WHERE t2.usuario_id = tpu.usuario_id AND t2.estado <> 'completada'
    ) AS abiertas
  FROM tasa_por_usuario tpu, umbral
  WHERE tpu.tasa_completado >= umbral.p90
) sub;
```

**Formato de salida esperado (listado)** (resultado real contra el seed):

| usuario_id | email | tasa_completado | total_tareas | tareas_abiertas_actualmente |
|---|---|---|---|---|
| 8 | hugo@correo.com | 0.92 | 143 | 11 |

**Formato de salida esperado (promedio)** (resultado real contra el seed):

| promedio_tareas_simultaneas_top10 |
|---|
| 11.0 |
