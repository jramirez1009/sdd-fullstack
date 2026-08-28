// Script puntual de diagnóstico: comprueba que DATABASE_URL responde.
// Uso: node bd/comprobar-conexion.js
import { pool, consultar } from '../src/config/bd.js';

try {
  const resultado = await consultar('SELECT 1 AS ok', []);
  console.log('Conexión correcta. SELECT 1 =>', resultado.rows[0].ok);
} catch (error) {
  console.error('No se pudo conectar a la base de datos:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
