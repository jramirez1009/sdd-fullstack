// Aplica bd/schema.sql contra DATABASE_URL. El archivo es idempotente, así que
// puede ejecutarse tantas veces como haga falta.
// Uso: node bd/ejecutar-schema.js
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from '../src/config/bd.js';

const rutaSchema = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql');

try {
  const sql = await readFile(rutaSchema, 'utf8');
  await pool.query(sql);
  console.log('schema.sql aplicado sin errores.');
} catch (error) {
  console.error('Falló la aplicación del esquema:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
