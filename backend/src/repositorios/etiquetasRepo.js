import { consultar } from '../config/bd.js';

// Todo el SQL del sistema vive en esta carpeta. Cada consulta es una cadena
// literal con marcadores de parámetro: ningún valor y ningún nombre de tabla se
// concatena jamás, ni siquiera cuando el valor no viene del cliente.

// Lista explícita de columnas públicas, nunca SELECT *: así la respuesta no
// puede ganar un campo por el hecho de que alguien añada una columna.
const COLUMNAS_PUBLICAS = 'id, nombre, creado_en';

// El identificador del dueño viaja en el WHERE de TODAS las consultas de este
// archivo, incluidas las de escritura. No hay ninguna comprobación de propiedad
// en el controlador: una etiqueta ajena sencillamente no se encuentra, de modo
// que solo existe un camino de código hacia el 404 y ninguna rama que pueda
// distinguir "no existe" de "es de otro". Por eso `usuarioId` es un parámetro
// obligatorio de las cuatro firmas.

/** Todas las etiquetas del usuario, ordenadas por nombre. */
export async function listarEtiquetas({ usuarioId }) {
  const { rows } = await consultar(
    `SELECT ${COLUMNAS_PUBLICAS}
     FROM etiquetas
     WHERE usuario_id = $1
     ORDER BY nombre`,
    [usuarioId],
  );
  return rows;
}

/**
 * Inserta una etiqueta del usuario. La violación de la restricción UNIQUE
 * (código 23505) se deja propagar para que la traduzca quien llama: comprobar
 * antes si el nombre existe abriría una condición de carrera que la propia
 * restricción cierra por definición.
 */
export async function insertarEtiqueta({ usuarioId, nombre }) {
  const { rows } = await consultar(
    `INSERT INTO etiquetas (usuario_id, nombre)
     VALUES ($1, $2)
     RETURNING ${COLUMNAS_PUBLICAS}`,
    [usuarioId, nombre],
  );
  return rows[0];
}

/** Renombra una etiqueta del usuario. Devuelve null si no hay tal fila suya. */
export async function actualizarEtiqueta({ id, usuarioId, nombre }) {
  const { rows } = await consultar(
    `UPDATE etiquetas
     SET nombre = $1
     WHERE id = $2 AND usuario_id = $3
     RETURNING ${COLUMNAS_PUBLICAS}`,
    [nombre, id, usuarioId],
  );
  return rows[0] ?? null;
}

/** Elimina una etiqueta del usuario. Devuelve si se eliminó alguna fila. */
export async function eliminarEtiqueta({ id, usuarioId }) {
  const { rowCount } = await consultar(
    `DELETE FROM etiquetas
     WHERE id = $1 AND usuario_id = $2`,
    [id, usuarioId],
  );
  return rowCount > 0;
}
