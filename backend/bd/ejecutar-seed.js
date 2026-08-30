// Aplica bd/seed.sql contra DATABASE_URL. Pensado para poblar la base con datos
// de ejemplo una sola vez, después de haber aplicado bd/schema.sql.
//
// El seed debe escribirse de forma idempotente (INSERT ... ON CONFLICT DO
// NOTHING o equivalente) para que reejecutarlo no duplique filas.
//
// Uso: node bd/ejecutar-seed.js
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from '../src/config/bd.js';

const rutaSeed = path.join(path.dirname(fileURLToPath(import.meta.url)), 'seed.sql');

try {
  const sql = await readFile(rutaSeed, 'utf8');
  await pool.query(sql);
  console.log('seed.sql aplicado sin errores.');
} catch (error) {
  if (error.code === 'ENOENT') {
    console.error(
      'No se encontró bd/seed.sql. Añádelo junto a bd/schema.sql antes de ejecutar este script.',
    );
  } else {
    console.error('Falló la aplicación del seed:', error.message);
  }
  process.exitCode = 1;
} finally {
  await pool.end();
}
