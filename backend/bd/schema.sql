-- =============================================================================
-- Esquema de la aplicación "Lista de Tareas"
-- =============================================================================
-- Se ejecuta contra la instancia PostgreSQL alojada en Supabase indicada por
-- DATABASE_URL. El archivo es idempotente: todas las sentencias usan
-- IF NOT EXISTS o su equivalente, de modo que reejecutarlo es inocuo.
--
-- Uso:  psql "$DATABASE_URL" -f bd/schema.sql
--   o:  node bd/ejecutar-schema.js
-- =============================================================================

-- CITEXT da comparación insensible a mayúsculas en la propia restricción, sin
-- depender de que cada consulta recuerde aplicar LOWER().
CREATE EXTENSION IF NOT EXISTS citext;

-- -----------------------------------------------------------------------------
-- usuarios
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email         CITEXT      NOT NULL UNIQUE,
    -- Nombre explícito: nunca debe confundirse con una contraseña en claro.
    password_hash TEXT        NOT NULL,
    -- Opcional (el registro no lo exige), pero si viene no puede ser cadena
    -- vacía: sería un tercer estado indistinguible de "sin nombre".
    nombre        TEXT        CONSTRAINT usuarios_nombre_longitud
                              CHECK (nombre IS NULL OR char_length(nombre) BETWEEN 1 AND 100),
    creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- categorias
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- Sin dueño el dato no es alcanzable por nadie: se borra con él.
    usuario_id BIGINT      NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
    nombre     CITEXT      NOT NULL
                           CONSTRAINT categorias_nombre_longitud
                           CHECK (char_length(nombre) BETWEEN 1 AND 100),
    creado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Unicidad por dueño: dos usuarios distintos sí pueden tener "Trabajo".
    CONSTRAINT categorias_usuario_nombre_unico UNIQUE (usuario_id, nombre)
);

-- -----------------------------------------------------------------------------
-- etiquetas
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS etiquetas (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id BIGINT      NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
    nombre     CITEXT      NOT NULL
                           CONSTRAINT etiquetas_nombre_longitud
                           CHECK (char_length(nombre) BETWEEN 1 AND 50),
    creado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT etiquetas_usuario_nombre_unico UNIQUE (usuario_id, nombre)
);

-- -----------------------------------------------------------------------------
-- tareas
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tareas (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id        BIGINT      NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
    -- Borrar una categoría es organización, no destrucción: la tarea sobrevive
    -- sin categoría.
    categoria_id      BIGINT      REFERENCES categorias (id) ON DELETE SET NULL,
    titulo            TEXT        NOT NULL
                                  CONSTRAINT tareas_titulo_longitud
                                  CHECK (char_length(titulo) BETWEEN 1 AND 200),
    descripcion       TEXT        CONSTRAINT tareas_descripcion_longitud
                                  CHECK (descripcion IS NULL OR char_length(descripcion) <= 2000),
    -- CHECK sobre conjunto cerrado en lugar de ENUM: ampliar el vocabulario es
    -- un ALTER trivial, evolucionar un ENUM no lo es.
    estado            TEXT        NOT NULL DEFAULT 'pendiente'
                                  CONSTRAINT tareas_estado_admitido
                                  CHECK (estado IN ('pendiente', 'en_progreso', 'completada')),
    prioridad         TEXT        NOT NULL DEFAULT 'media'
                                  CONSTRAINT tareas_prioridad_admitida
                                  CHECK (prioridad IN ('baja', 'media', 'alta')),
    -- DATE y no TIMESTAMPTZ: una tarea vence un día, no a una hora; así
    -- "vencida" no cambia de significado según la zona horaria del consultante.
    fecha_vencimiento DATE,
    creado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Vacío mientras la tarea no esté completada. Es un hecho que solo puede
    -- capturarse en el instante en que ocurre.
    completada_en     TIMESTAMPTZ
);

-- Búsqueda por texto libre sobre el contenido de la tarea.
-- Columna generada y no disparador ni actualización desde la aplicación: una
-- columna generada no puede quedar desincronizada del título y la descripción,
-- por el mismo criterio que ya se aplicó a actualizado_en.
-- La configuración 'spanish' va nombrada explícitamente (y no implícita) porque
-- to_tsvector solo es inmutable —y por tanto admisible en una columna generada—
-- cuando no depende del parámetro de sesión default_text_search_config. Aporta
-- lematización e insensibilidad a acentos y a mayúsculas.
ALTER TABLE tareas
    ADD COLUMN IF NOT EXISTS busqueda_tsv TSVECTOR
    GENERATED ALWAYS AS (
        to_tsvector('spanish', coalesce(titulo, '') || ' ' || coalesce(descripcion, ''))
    ) STORED;

-- -----------------------------------------------------------------------------
-- tarea_etiquetas (relación muchos a muchos)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tarea_etiquetas (
    tarea_id    BIGINT NOT NULL REFERENCES tareas (id)    ON DELETE CASCADE,
    etiqueta_id BIGINT NOT NULL REFERENCES etiquetas (id) ON DELETE CASCADE,
    -- La clave compuesta da gratis el requisito de que una etiqueta no se
    -- asocie dos veces a la misma tarea.
    PRIMARY KEY (tarea_id, etiqueta_id)
);

-- -----------------------------------------------------------------------------
-- Disparador: mantiene tareas.actualizado_en
-- -----------------------------------------------------------------------------
-- Vive en la base y no en la aplicación: un disparador no puede olvidarse en
-- una consulta de escritura nueva.
CREATE OR REPLACE FUNCTION tareas_marcar_actualizado_en()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tareas_actualizado_en ON tareas;
CREATE TRIGGER tareas_actualizado_en
    BEFORE UPDATE ON tareas
    FOR EACH ROW
    EXECUTE FUNCTION tareas_marcar_actualizado_en();

-- -----------------------------------------------------------------------------
-- Índices
-- -----------------------------------------------------------------------------
-- Todos llevan usuario_id como primera columna: ninguna consulta de negocio
-- cruza jamás la frontera de un usuario.

-- Listado principal filtrado por estado y recuento de tareas por estado.
CREATE INDEX IF NOT EXISTS tareas_usuario_estado_idx
    ON tareas (usuario_id, estado);

-- Filtro por categoría y agregación de tareas por categoría.
CREATE INDEX IF NOT EXISTS tareas_usuario_categoria_idx
    ON tareas (usuario_id, categoria_id);

-- Filtro por prioridad y distribución de tareas por prioridad.
CREATE INDEX IF NOT EXISTS tareas_usuario_prioridad_idx
    ON tareas (usuario_id, prioridad);

-- Filtro por rango de fechas y consulta de tareas vencidas o próximas a vencer.
CREATE INDEX IF NOT EXISTS tareas_usuario_vencimiento_idx
    ON tareas (usuario_id, fecha_vencimiento);

-- Filtro de búsqueda por texto. Es el único índice que no lleva usuario_id como
-- primera columna: un GIN no admite una columna escalar como primera clave sin
-- la extensión btree_gin. El planificador lo combina con el índice B-tree que ya
-- filtra por usuario mediante un BitmapAnd, suficiente para este volumen.
CREATE INDEX IF NOT EXISTS tareas_usuario_busqueda_idx
    ON tareas USING GIN (busqueda_tsv);

-- La clave primaria compuesta cubre la navegación tarea -> etiquetas; este
-- índice cubre la dirección inversa (filtrar tareas por etiqueta, contar uso).
CREATE INDEX IF NOT EXISTS tarea_etiquetas_etiqueta_idx
    ON tarea_etiquetas (etiqueta_id);

-- categorias (usuario_id) y etiquetas (usuario_id) quedan cubiertos por el
-- índice de sus restricciones UNIQUE (usuario_id, nombre): no se crean aparte.

-- =============================================================================
-- Reversión (procedimiento documentado, NO se ejecuta)
-- =============================================================================
-- Destruye el esquema completo y todos sus datos. Descomentar y ejecutar a mano
-- solo para rehacer el esquema desde cero mientras no haya datos reales.
-- El orden es el inverso al de dependencia.
--
-- Para revertir solo la búsqueda por texto, sin destruir nada más (la columna es
-- derivada: al recrearla se rellena sola, no hay pérdida de datos):
--
-- DROP INDEX IF EXISTS tareas_usuario_busqueda_idx;
-- ALTER TABLE tareas DROP COLUMN IF EXISTS busqueda_tsv;
--
-- DROP TABLE IF EXISTS tarea_etiquetas;
-- DROP TABLE IF EXISTS tareas;
-- DROP TABLE IF EXISTS etiquetas;
-- DROP TABLE IF EXISTS categorias;
-- DROP TABLE IF EXISTS usuarios;
-- DROP FUNCTION IF EXISTS tareas_marcar_actualizado_en();
