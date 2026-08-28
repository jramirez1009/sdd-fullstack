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
