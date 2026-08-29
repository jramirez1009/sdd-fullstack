import { consultar, conTransaccion } from '../config/bd.js';
import { errorReferenciaInvalida } from '../utils/errores.js';

// Todo el SQL del sistema vive en esta carpeta. Cada consulta es una cadena
// literal con marcadores de parámetro: ningún valor y ningún nombre de tabla se
// concatena jamás, ni siquiera cuando el valor no viene del cliente.
//
// Este archivo es el único con una consulta cuya forma depende de la petición
// —el listado admite siete filtros combinables y cuatro ordenaciones—, así que
// la separación es estricta: los valores viajan siempre como parámetros, y los
// identificadores de columna salen siempre de mapas constantes de este módulo.
//
// El identificador del dueño viaja en el WHERE de TODAS las consultas del
// archivo, incluidas las de escritura, y es un parámetro obligatorio de todas
// las firmas. No hay ninguna comprobación de propiedad en el controlador: una
// tarea ajena sencillamente no se encuentra, de modo que solo existe un camino
// de código hacia el 404 y ninguna rama que pueda distinguir "no existe" de
// "es de otro".

/**
 * Los instantes embebidos en JSON se formatean a mano porque `json_build_object`
 * los rendería con el formato de PostgreSQL (`+00:00`) mientras que las
 * columnas que pasan por el driver llegan como `Date` y se serializan con la
 * `Z` de `toISOString()`. Sin esto, la misma fecha llegaría escrita de dos
 * formas distintas según viniera dentro de la categoría o fuera de ella.
 */
const INSTANTE_CATEGORIA = `to_char(c.creado_en AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
const INSTANTE_ETIQUETA = `to_char(e.creado_en AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

/**
 * Proyección pública de una tarea. Lista explícita de columnas, nunca SELECT *
 * ni `to_jsonb(e.*)`: así ni la respuesta ni las etiquetas embebidas pueden
 * ganar un campo —`usuario_id`, el primero— por el hecho de que alguien añada
 * una columna a una tabla.
 *
 * - El identificador sale como texto: es un BIGINT cuyo valor puede exceder la
 *   precisión de un número en JSON, y redondearlo apuntaría a otra fila.
 * - `fecha_vencimiento` sale como texto porque es un DATE: convertido a `Date`
 *   por el driver, serializarlo desplazaría el día según la zona horaria.
 * - La traducción entre el `estado` del esquema y el booleano `completada` de
 *   la API vive aquí y solo aquí: fuera del repositorio nadie conoce `estado`.
 * - Las etiquetas se agregan con una subconsulta lateral y no con un JOIN
 *   directo: un JOIN multiplicaría las filas por el número de etiquetas y
 *   obligaría a reagrupar en JavaScript. `COALESCE` produce `[]` y no `null`
 *   cuando no hay ninguna, para que el cliente no distinga dos formas de
 *   "sin etiquetas".
 */
const PROYECCION = `
  SELECT
      t.id::text                  AS id,
      t.titulo                    AS titulo,
      t.descripcion               AS descripcion,
      t.prioridad                 AS prioridad,
      t.fecha_vencimiento::text   AS fecha_vencimiento,
      (t.estado = 'completada')   AS completada,
      t.creado_en                 AS creado_en,
      t.actualizado_en            AS actualizado_en,
      t.completada_en             AS completada_en,
      CASE
          WHEN c.id IS NULL THEN NULL
          ELSE json_build_object('id', c.id::text, 'nombre', c.nombre, 'creado_en', ${INSTANTE_CATEGORIA})
      END                         AS categoria,
      COALESCE(agregadas.etiquetas, '[]'::json) AS etiquetas
  FROM tareas t
  LEFT JOIN categorias c ON c.id = t.categoria_id
  LEFT JOIN LATERAL (
      SELECT json_agg(
                 json_build_object('id', e.id::text, 'nombre', e.nombre, 'creado_en', ${INSTANTE_ETIQUETA})
                 ORDER BY e.nombre
             ) AS etiquetas
      FROM tarea_etiquetas te
      JOIN etiquetas e ON e.id = te.etiqueta_id
      WHERE te.tarea_id = t.id
  ) agregadas ON TRUE`;

/**
 * Expresiones de ordenación admitidas. Un identificador de columna no puede ser
 * un parámetro preparado, así que la única defensa contra la inyección en el
 * ORDER BY es esta lista blanca: una clave que no esté aquí no produce un orden
 * alternativo, produce el orden por defecto —y antes de eso, un 400 en la
 * validación—. Nada de lo que llega en la petición se interpola.
 *
 * El orden por prioridad es el de negocio: el CASE crece con la urgencia, de
 * modo que la dirección descendente —la que la validación aplica por defecto a
 * este campo— pone las tareas de prioridad alta primero. El alfabético (alta,
 * baja, media) no significa nada para nadie.
 *
 * Una tarea sin fecha de vencimiento no es ni la más urgente ni la más lejana,
 * así que queda al final en ambas direcciones.
 */
const EXPRESIONES_ORDEN = {
  creado_en: { expresion: 't.creado_en', nulos: '' },
  titulo: { expresion: 't.titulo', nulos: '' },
  prioridad: {
    expresion: "CASE t.prioridad WHEN 'alta' THEN 3 WHEN 'media' THEN 2 ELSE 1 END",
    nulos: '',
  },
  fecha_vencimiento: { expresion: 't.fecha_vencimiento', nulos: ' NULLS LAST' },
};

const DIRECCIONES_SQL = { asc: 'ASC', desc: 'DESC' };

const ORDEN_POR_DEFECTO = { campo: 'creado_en', direccion: 'desc' };

// Valor reservado del filtro de categoría. Se consume entero aquí y nunca llega
// a la consulta como parámetro.
const CATEGORIA_SIN_ASIGNAR = 'ninguna';

/**
 * Construye la cláusula ORDER BY a partir de los mapas constantes de arriba.
 * El desempate por identificador va siempre al final: sin él, dos consultas
 * idénticas pueden devolver las tareas empatadas en distinto orden y hacer
 * parecer que la lista salta sola.
 */
function construirOrden(orden) {
  const campo = Object.hasOwn(EXPRESIONES_ORDEN, orden?.campo ?? '')
    ? orden.campo
    : ORDEN_POR_DEFECTO.campo;
  const direccion = Object.hasOwn(DIRECCIONES_SQL, orden?.direccion ?? '')
    ? orden.direccion
    : ORDEN_POR_DEFECTO.direccion;

  const { expresion, nulos } = EXPRESIONES_ORDEN[campo];
  return `ORDER BY ${expresion} ${DIRECCIONES_SQL[direccion]}${nulos}, t.id DESC`;
}

/**
 * Todas las tareas del usuario que cumplen los filtros, con su categoría y sus
 * etiquetas embebidas, en una sola ida a la base.
 *
 * Cada filtro aporta una condición literal escrita en el código y empuja su
 * valor al array de parámetros; el único elemento que varía en el texto SQL es
 * el número del marcador, que lo lleva la longitud de ese array y no ninguna
 * entrada del cliente.
 */
export async function listarTareas({ usuarioId, filtros = {}, orden = ORDEN_POR_DEFECTO }) {
  // El filtro por dueño se añade siempre y el primero, antes de mirar ningún
  // otro. No es una condición más: es la que hace que ninguna combinación de
  // parámetros pueda devolver una tarea ajena.
  const condiciones = ['t.usuario_id = $1'];
  const parametros = [usuarioId];

  if (filtros.completada !== undefined) {
    parametros.push(filtros.completada);
    condiciones.push(`(t.estado = 'completada') = $${parametros.length}`);
  }

  if (filtros.categoria !== undefined) {
    if (filtros.categoria === CATEGORIA_SIN_ASIGNAR) {
      // El valor reservado no se pasa nunca como parámetro: se consume aquí y
      // produce una condición literal, así que no hay forma de que una cadena
      // del cliente acabe comparándose con una columna.
      condiciones.push('t.categoria_id IS NULL');
    } else {
      parametros.push(filtros.categoria);
      condiciones.push(`t.categoria_id = $${parametros.length}`);
    }
  }

  if (filtros.prioridad !== undefined) {
    parametros.push(filtros.prioridad);
    condiciones.push(`t.prioridad = $${parametros.length}`);
  }

  // Rango inclusivo en ambos extremos. Una tarea sin fecha de vencimiento no
  // entra en ningún rango: la comparación con NULL no es verdadera.
  if (filtros.fecha_vencimiento_desde !== undefined) {
    parametros.push(filtros.fecha_vencimiento_desde);
    condiciones.push(`t.fecha_vencimiento >= $${parametros.length}::date`);
  }

  if (filtros.fecha_vencimiento_hasta !== undefined) {
    parametros.push(filtros.fecha_vencimiento_hasta);
    condiciones.push(`t.fecha_vencimiento <= $${parametros.length}::date`);
  }

  if (filtros.busqueda !== undefined) {
    // websearch_to_tsquery y no to_tsquery: acepta cualquier cadena que una
    // persona teclee —comillas, signos sueltos, operadores— sin lanzar error de
    // sintaxis, que es exactamente lo que un cuadro de búsqueda necesita.
    parametros.push(filtros.busqueda);
    condiciones.push(`t.busqueda_tsv @@ websearch_to_tsquery('spanish', $${parametros.length})`);
  }

  if (filtros.etiquetas !== undefined && filtros.etiquetas.length > 0) {
    // Conjunción: la tarea ha de tener todas las etiquetas pedidas. Se cuenta
    // cuántas de ellas tiene y se exige que sean tantas como se pidieron.
    //
    // Los nombres van como un único parámetro de tipo array con `= ANY`, no
    // como un `IN` con marcadores generados: generar `IN ($3, $4, $5)` sería
    // construir texto SQL a partir de la longitud de una lista del cliente.
    //
    // Se deduplican antes de contar, porque pedir dos veces el mismo nombre no
    // exige tenerlo dos veces. `nombre` es CITEXT: la comparación ya ignora
    // mayúsculas y minúsculas sin que la consulta tenga que recordarlo.
    const nombres = [...new Set(filtros.etiquetas)];
    parametros.push(usuarioId);
    const marcadorUsuario = parametros.length;
    parametros.push(nombres);
    const marcadorNombres = parametros.length;
    parametros.push(nombres.length);
    const marcadorCuantas = parametros.length;
    condiciones.push(
      `(SELECT count(*)
          FROM tarea_etiquetas te2
          JOIN etiquetas e2 ON e2.id = te2.etiqueta_id
         WHERE te2.tarea_id = t.id
           AND e2.usuario_id = $${marcadorUsuario}
           AND e2.nombre = ANY($${marcadorNombres}::citext[])) = $${marcadorCuantas}`,
    );
  }

  const { rows } = await consultar(
    `${PROYECCION}
     WHERE ${condiciones.join(' AND ')}
     ${construirOrden(orden)}`,
    parametros,
  );
  return rows;
}

/**
 * Una tarea concreta del usuario, con la misma proyección que el listado, o
 * null si no hay tal fila suya. `ejecutar` permite componer la respuesta dentro
 * de una transacción, viendo sus propias escrituras.
 */
export async function obtenerTarea({ id, usuarioId }, ejecutar = consultar) {
  const { rows } = await ejecutar(
    `${PROYECCION}
     WHERE t.id = $1 AND t.usuario_id = $2`,
    [id, usuarioId],
  );
  return rows[0] ?? null;
}

/**
 * Comprueba que la categoría es del usuario. Se hace dentro de la transacción y
 * no antes: comprobar y después escribir sería una condición de carrera, porque
 * la categoría puede borrarse en medio.
 */
async function verificarCategoriaDelUsuario(cliente, { categoriaId, usuarioId }) {
  const { rowCount } = await cliente.query(
    `SELECT 1 FROM categorias WHERE id = $1 AND usuario_id = $2`,
    [categoriaId, usuarioId],
  );
  return rowCount > 0;
}

/**
 * Comprueba que todas las etiquetas son del usuario comparando cuántas volvieron
 * con cuántas se pidieron. Una etiqueta ajena y una inexistente producen el
 * mismo resultado negativo: la consulta no puede verlas y no hay forma de
 * distinguirlas desde fuera.
 */
async function verificarEtiquetasDelUsuario(cliente, { etiquetaIds, usuarioId }) {
  const pedidas = [...new Set(etiquetaIds)];
  if (pedidas.length === 0) {
    return true;
  }
  const { rowCount } = await cliente.query(
    `SELECT id FROM etiquetas WHERE usuario_id = $1 AND id = ANY($2::bigint[])`,
    [usuarioId, pedidas],
  );
  return rowCount === pedidas.length;
}

/**
 * Verifica las referencias del cuerpo y lanza el error de referencia inválida a
 * la primera que no sea del usuario. Al lanzarse dentro de la transacción, el
 * ROLLBACK deshace la tarea a medio escribir: o queda con todas sus etiquetas,
 * o no queda nada.
 */
async function verificarReferencias(cliente, { usuarioId, datos }) {
  if (datos.categoria_id !== null && datos.categoria_id !== undefined) {
    const propia = await verificarCategoriaDelUsuario(cliente, {
      categoriaId: datos.categoria_id,
      usuarioId,
    });
    if (!propia) {
      throw errorReferenciaInvalida('categoria');
    }
  }

  if (Array.isArray(datos.etiquetas)) {
    const propias = await verificarEtiquetasDelUsuario(cliente, {
      etiquetaIds: datos.etiquetas,
      usuarioId,
    });
    if (!propias) {
      throw errorReferenciaInvalida('etiquetas');
    }
  }
}

/**
 * Asocia la tarea con exactamente estas etiquetas.
 *
 * `tarea_etiquetas` no tiene columna de dueño, así que la propiedad se exige
 * uniendo con las dos tablas que sí la tienen: solo se escribe el vínculo si la
 * tarea es del usuario y la etiqueta también. Las referencias ya se verificaron
 * antes en la misma transacción; esto lo hace además cierto por construcción,
 * de modo que la garantía no dependa del orden en que se llame a la función.
 *
 * El DISTINCT es lo que hace que enviar dos veces el mismo identificador deje
 * una sola fila de vínculo; el ON CONFLICT cubre además la carrera con otra
 * petición simultánea.
 */
async function asociarEtiquetas(cliente, { tareaId, usuarioId, etiquetaIds }) {
  if (etiquetaIds.length === 0) {
    return;
  }
  await cliente.query(
    `INSERT INTO tarea_etiquetas (tarea_id, etiqueta_id)
     SELECT DISTINCT t.id, e.id
     FROM tareas t
     JOIN etiquetas e ON e.usuario_id = t.usuario_id
     WHERE t.id = $1 AND t.usuario_id = $2 AND e.id = ANY($3::bigint[])
     ON CONFLICT DO NOTHING`,
    [tareaId, usuarioId, etiquetaIds],
  );
}

/**
 * Retira todos los vínculos de una tarea del usuario. Solo se borran los
 * vínculos: las etiquetas en sí siguen existiendo para otras tareas.
 */
async function desasociarEtiquetas(cliente, { tareaId, usuarioId }) {
  await cliente.query(
    `DELETE FROM tarea_etiquetas te
     USING tareas t
     WHERE te.tarea_id = t.id AND t.id = $1 AND t.usuario_id = $2`,
    [tareaId, usuarioId],
  );
}

/**
 * Crea una tarea del usuario con sus etiquetas. Toda la operación va en una
 * transacción porque toca dos tablas y el contrato es "o todas o ninguna".
 *
 * La tarea nace con el estado y la prioridad que fija el esquema si no se
 * indican: `pendiente`, sin instante de finalización y prioridad `media`.
 */
export async function crearTarea({ usuarioId, datos }) {
  return conTransaccion(async (cliente) => {
    await verificarReferencias(cliente, { usuarioId, datos });

    const { rows } = await cliente.query(
      `INSERT INTO tareas (usuario_id, categoria_id, titulo, descripcion, prioridad, fecha_vencimiento)
       VALUES ($1, $2, $3, $4, $5, $6::date)
       RETURNING id`,
      [
        usuarioId,
        datos.categoria_id,
        datos.titulo,
        datos.descripcion,
        datos.prioridad,
        datos.fecha_vencimiento,
      ],
    );
    const id = rows[0].id;

    await asociarEtiquetas(cliente, { tareaId: id, usuarioId, etiquetaIds: datos.etiquetas ?? [] });

    return obtenerTarea({ id, usuarioId }, (texto, parametros) => cliente.query(texto, parametros));
  });
}

/**
 * Sustituye el contenido de una tarea del usuario. Devuelve null si no hay tal
 * fila suya, que es el único camino hacia el 404.
 *
 * El conjunto de etiquetas se sustituye solo si el campo venía en la petición:
 * `datos.etiquetas` es null cuando no venía y un array cuando sí. Omitirlas las
 * conserva, porque la alternativa —borrarlas por omisión— haría que editar solo
 * el título perdiera las etiquetas sin que nadie lo hubiera pedido.
 *
 * Ni el dueño ni el estado de completada se tocan: no aparecen en el SET.
 */
export async function actualizarTarea({ id, usuarioId, datos }) {
  return conTransaccion(async (cliente) => {
    // Se comprueba primero que la tarea es suya, para que un identificador
    // ajeno o inexistente dé 404 y no 400 por una referencia del cuerpo. El
    // bloqueo de fila impide además que una edición simultánea se pierda.
    const existente = await cliente.query(
      `SELECT id FROM tareas WHERE id = $1 AND usuario_id = $2 FOR UPDATE`,
      [id, usuarioId],
    );
    if (existente.rowCount === 0) {
      return null;
    }

    await verificarReferencias(cliente, { usuarioId, datos });

    const { rowCount } = await cliente.query(
      `UPDATE tareas
       SET categoria_id = $1,
           titulo = $2,
           descripcion = $3,
           prioridad = $4,
           fecha_vencimiento = $5::date
       WHERE id = $6 AND usuario_id = $7`,
      [
        datos.categoria_id,
        datos.titulo,
        datos.descripcion,
        datos.prioridad,
        datos.fecha_vencimiento,
        id,
        usuarioId,
      ],
    );
    if (rowCount === 0) {
      return null;
    }

    if (Array.isArray(datos.etiquetas)) {
      // Se sustituye el conjunto entero.
      await desasociarEtiquetas(cliente, { tareaId: id, usuarioId });
      await asociarEtiquetas(cliente, { tareaId: id, usuarioId, etiquetaIds: datos.etiquetas });
    }

    return obtenerTarea({ id, usuarioId }, (texto, parametros) => cliente.query(texto, parametros));
  });
}

/**
 * Fija el estado de completada de una tarea del usuario a partir del booleano
 * recibido. Devuelve null si no hay tal fila suya.
 *
 * Las dos columnas se fijan a la vez en una sola sentencia, y no con un "leer,
 * decidir, escribir": así dos peticiones concurrentes no pueden dejar `estado`
 * y `completada_en` contando cosas distintas, y la operación es idempotente sin
 * esfuerzo —repetirla escribe el mismo estado, no el contrario—.
 */
export async function fijarCompletada({ id, usuarioId, completada }) {
  const { rowCount } = await consultar(
    `UPDATE tareas
     SET estado = CASE WHEN $1 THEN 'completada' ELSE 'pendiente' END,
         completada_en = CASE WHEN $1 THEN NOW() ELSE NULL END
     WHERE id = $2 AND usuario_id = $3`,
    [completada, id, usuarioId],
  );
  if (rowCount === 0) {
    return null;
  }
  return obtenerTarea({ id, usuarioId });
}

/**
 * Elimina una tarea del usuario. Devuelve si se eliminó alguna fila.
 *
 * Los vínculos de `tarea_etiquetas` desaparecen por la cascada declarada en el
 * esquema, no por una sentencia de este archivo que pudiera olvidarse. La
 * categoría y las etiquetas en sí no se tocan: siguen existiendo para otras
 * tareas.
 */
export async function eliminarTarea({ id, usuarioId }) {
  const { rowCount } = await consultar(
    `DELETE FROM tareas
     WHERE id = $1 AND usuario_id = $2`,
    [id, usuarioId],
  );
  return rowCount > 0;
}
