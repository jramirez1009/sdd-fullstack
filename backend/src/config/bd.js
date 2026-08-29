import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

// Un único Pool por proceso: Supabase limita las conexiones concurrentes, así que
// el máximo es deliberadamente conservador y las conexiones ociosas se liberan pronto.
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (error) => {
  // Un cliente ocioso puede caerse sin que haya una petición en curso; se registra
  // en el servidor y el pool crea otro en la siguiente consulta.
  console.error('Error en un cliente ocioso del pool de PostgreSQL:', error);
});

/**
 * Ejecuta una consulta parametrizada. Es el único punto por el que los
 * repositorios hablan con la base de datos.
 */
export function consultar(texto, parametros) {
  return pool.query(texto, parametros);
}

/**
 * Ejecuta `fn` dentro de una transacción, pasándole el cliente reservado.
 *
 * Existe porque este proyecto tiene escrituras que tocan dos tablas —una tarea
 * y sus etiquetas—: sin transacción, un fallo intermedio dejaría una tarea sin
 * las etiquetas que se pidieron, y el contrato es "o todas o ninguna".
 *
 * El cliente se libera en ambos caminos: no basta con hacerlo tras el COMMIT,
 * porque una excepción dejaría la conexión reservada para siempre y el pool se
 * agotaría en la quinta petición fallida.
 */
export async function conTransaccion(fn) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await fn(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (error) {
    // El ROLLBACK puede fallar a su vez si la conexión se cayó; el error que
    // interesa propagar es el original, no el del intento de deshacer.
    try {
      await cliente.query('ROLLBACK');
    } catch (errorRollback) {
      console.error('Falló el ROLLBACK de una transacción:', errorRollback);
    }
    throw error;
  } finally {
    cliente.release();
  }
}
