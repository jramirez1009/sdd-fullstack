import { consultar } from '../config/bd.js';

// Todo el SQL del sistema vive en esta carpeta y en ninguna otra, y toda
// consulta usa marcadores de parámetro ($1, $2, ...): ningún valor se concatena
// jamás en la cadena SQL.

// Lista explícita de columnas públicas. No se usa SELECT * para después borrar
// el hash: una lista explícita no puede olvidarse de eliminar nada.
const COLUMNAS_PUBLICAS = 'id, email, nombre, creado_en, ultimo_login';

/**
 * Inserta un usuario y devuelve sus datos públicos. La violación de la
 * restricción UNIQUE del email se deja propagar (código 23505 de PostgreSQL)
 * para que la traduzca quien llama: comprobar antes si el email existe abriría
 * una condición de carrera entre la comprobación y la inserción.
 */
export async function insertarUsuario({ email, passwordHash, nombre }) {
  const { rows } = await consultar(
    `INSERT INTO usuarios (email, password_hash, nombre)
     VALUES ($1, $2, $3)
     RETURNING ${COLUMNAS_PUBLICAS}`,
    [email, passwordHash, nombre ?? null],
  );
  return rows[0];
}

/**
 * Única consulta del sistema que trae `password_hash`. Su resultado se usa solo
 * para comparar la contraseña y nunca se pasa a una respuesta.
 * La columna `email` es CITEXT, así que la comparación ignora las mayúsculas.
 */
export async function buscarUsuarioPorEmailConHash(email) {
  const { rows } = await consultar(
    `SELECT id, email, nombre, creado_en, password_hash
     FROM usuarios
     WHERE email = $1`,
    [email],
  );
  return rows[0] ?? null;
}

/**
 * Datos públicos del usuario por identificador. Alimenta `GET /api/auth/perfil`.
 */
export async function buscarUsuarioPorId(id) {
  const { rows } = await consultar(
    `SELECT ${COLUMNAS_PUBLICAS}
     FROM usuarios
     WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/**
 * Registra el instante actual como último inicio de sesión del usuario. Se llama
 * solo tras validar las credenciales de un login exitoso. Es un efecto
 * secundario del login: quien llama no debe encadenar el éxito de la petición a
 * esta escritura (ver `authControlador.login`).
 */
export async function actualizarUltimoLogin(id) {
  await consultar(
    `UPDATE usuarios SET ultimo_login = NOW() WHERE id = $1`,
    [id],
  );
}

export { COLUMNAS_PUBLICAS };
