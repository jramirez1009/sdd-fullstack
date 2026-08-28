import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';

// El proceso puede arrancarse desde cualquier directorio; el .env vive junto al
// package.json del backend, así que se resuelve de forma absoluta.
const directorioBackend = path.resolve(fileURLToPath(import.meta.url), '../../..');
dotenv.config({ path: path.join(directorioBackend, '.env'), quiet: true });

const LONGITUD_MINIMA_SECRETO = 32;

/**
 * Comprueba las variables de entorno imprescindibles. Devuelve la lista de
 * problemas encontrados; vacía si la configuración es válida.
 */
function recogerProblemas(entorno) {
  const problemas = [];

  if (!entorno.DATABASE_URL || entorno.DATABASE_URL.trim() === '') {
    problemas.push('DATABASE_URL no está definida: sin ella la API no puede conectarse a PostgreSQL.');
  }

  const secreto = entorno.JWT_SECRET ?? '';
  if (secreto.trim() === '') {
    problemas.push('JWT_SECRET no está definida: sin ella no se pueden firmar ni verificar los tokens.');
  } else if (secreto.length < LONGITUD_MINIMA_SECRETO) {
    problemas.push(
      `JWT_SECRET mide ${secreto.length} caracteres y debe medir al menos ${LONGITUD_MINIMA_SECRETO}: ` +
        'un secreto corto es vulnerable a fuerza bruta y comprometería todas las cuentas.',
    );
  }

  return problemas;
}

const problemas = recogerProblemas(process.env);

if (problemas.length > 0) {
  console.error('Configuración inválida. El servidor no puede arrancar:');
  for (const problema of problemas) {
    console.error(`  - ${problema}`);
  }
  console.error('Revisa backend/.env tomando backend/.env.example como referencia.');
  process.exit(1);
}

export const env = {
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRACION: process.env.JWT_EXPIRACION || '24h',
  PORT: Number(process.env.PORT) || 3000,
};

export { recogerProblemas, LONGITUD_MINIMA_SECRETO };
