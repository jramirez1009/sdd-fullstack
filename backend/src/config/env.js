import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';

// El proceso puede arrancarse desde cualquier directorio; el .env vive junto al
// package.json del backend, así que se resuelve de forma absoluta.
const directorioBackend = path.resolve(fileURLToPath(import.meta.url), '../../..');
dotenv.config({ path: path.join(directorioBackend, '.env'), quiet: true });

const LONGITUD_MINIMA_SECRETO = 32;

/**
 * Variables de límite de peticiones con su valor por defecto. Ausentes toman el
 * valor por defecto sin protestar; presentes pero inválidas detienen el
 * arranque: "no lo he configurado" es normal, "lo he configurado mal" es un
 * error que en producción dejaría un límite distinto del que alguien creyó fijar.
 */
const ENTEROS_POSITIVOS = {
  RATE_LIMIT_VENTANA_MS: 60000,
  RATE_LIMIT_MAX: 100,
  RATE_LIMIT_LOGIN_VENTANA_MS: 900000,
  RATE_LIMIT_LOGIN_MAX: 10,
};

const FORMATOS_LOG = ['legible', 'json'];
const NIVELES_LOG = ['info', 'silencio'];

const FORMATO_LOG_POR_DEFECTO = 'legible';
const NIVEL_LOG_POR_DEFECTO = 'info';

function esEnteroPositivo(valor) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0;
}

/** Lee una variable de la lista de enteros positivos aplicando su valor por defecto. */
function leerEnteroPositivo(entorno, nombre) {
  const bruto = entorno[nombre];
  if (bruto === undefined || bruto.trim() === '') {
    return ENTEROS_POSITIVOS[nombre];
  }
  return Number(bruto);
}

/** Lee una variable de conjunto cerrado (formato, nivel) aplicando su valor por defecto. */
function leerOpcion(entorno, nombre, porDefecto) {
  const bruto = entorno[nombre];
  if (bruto === undefined || bruto.trim() === '') {
    return porDefecto;
  }
  return bruto.trim();
}

/**
 * Normaliza `TRUST_PROXY` al valor que espera `app.set('trust proxy', …)`:
 * booleano para no confiar / confiar, o el número de saltos hasta el cliente.
 * Devuelve `undefined` si el valor no se reconoce, para que el arranque falle.
 */
function normalizarTrustProxy(bruto) {
  if (bruto === undefined || bruto.trim() === '') {
    return false;
  }
  const valor = bruto.trim().toLowerCase();
  if (valor === 'false') {
    return false;
  }
  if (valor === 'true') {
    return true;
  }
  if (/^\d+$/.test(valor)) {
    return Number(valor);
  }
  return undefined;
}

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

  for (const nombre of Object.keys(ENTEROS_POSITIVOS)) {
    const bruto = entorno[nombre];
    if (bruto === undefined || bruto.trim() === '') {
      continue;
    }
    if (!esEnteroPositivo(bruto)) {
      problemas.push(
        `${nombre} vale "${bruto}" y debe ser un número entero mayor que cero: ` +
          'un valor distinto dejaría activo un límite diferente del que se quiso fijar.',
      );
    }
  }

  const formato = entorno.LOG_FORMATO;
  if (formato !== undefined && formato.trim() !== '' && !FORMATOS_LOG.includes(formato.trim())) {
    problemas.push(
      `LOG_FORMATO vale "${formato}" y solo admite ${FORMATOS_LOG.join(' o ')}.`,
    );
  }

  const nivel = entorno.LOG_NIVEL;
  if (nivel !== undefined && nivel.trim() !== '' && !NIVELES_LOG.includes(nivel.trim())) {
    problemas.push(
      `LOG_NIVEL vale "${nivel}" y solo admite ${NIVELES_LOG.join(' o ')}.`,
    );
  }

  if (normalizarTrustProxy(entorno.TRUST_PROXY) === undefined) {
    problemas.push(
      `TRUST_PROXY vale "${entorno.TRUST_PROXY}" y solo admite false, true o el número de proxies de confianza.`,
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
  RATE_LIMIT_VENTANA_MS: leerEnteroPositivo(process.env, 'RATE_LIMIT_VENTANA_MS'),
  RATE_LIMIT_MAX: leerEnteroPositivo(process.env, 'RATE_LIMIT_MAX'),
  RATE_LIMIT_LOGIN_VENTANA_MS: leerEnteroPositivo(process.env, 'RATE_LIMIT_LOGIN_VENTANA_MS'),
  RATE_LIMIT_LOGIN_MAX: leerEnteroPositivo(process.env, 'RATE_LIMIT_LOGIN_MAX'),
  LOG_FORMATO: leerOpcion(process.env, 'LOG_FORMATO', FORMATO_LOG_POR_DEFECTO),
  LOG_NIVEL: leerOpcion(process.env, 'LOG_NIVEL', NIVEL_LOG_POR_DEFECTO),
  TRUST_PROXY: normalizarTrustProxy(process.env.TRUST_PROXY),
};

export { recogerProblemas, LONGITUD_MINIMA_SECRETO, FORMATOS_LOG, NIVELES_LOG };
