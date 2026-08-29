const NS_POR_MS = 1_000_000;
const DECIMALES_MS = 1;
const ANCHO_METODO = 6;
const ANCHO_ESTADO = 3;

/**
 * Fábrica del registro de peticiones. Escribe una entrada por petición atendida
 * en la salida estándar del proceso: ni ficheros propios ni rotación.
 *
 * La redacción de datos sensibles es estructural y no una lista de campos a
 * censurar: este módulo no lee `req.body` en ningún punto, y de la cabecera
 * `Authorization` solo evalúa su presencia, nunca su contenido. Una lista de
 * campos censurados es una lista que alguien olvidará ampliar cuando llegue un
 * endpoint nuevo; no leer el cuerpo no se olvida.
 *
 * @param {{ formato: 'legible' | 'json', nivel: 'info' | 'silencio' }} opciones
 * @returns {import('express').RequestHandler}
 */
export function crearRegistroPeticiones({ formato, nivel }) {
  // El nivel se comprueba una sola vez, al construir: en silencio no se engancha
  // nada a la respuesta ni se toma ninguna marca de tiempo.
  if (nivel === 'silencio') {
    return function registroSilenciado(_req, _res, siguiente) {
      siguiente();
    };
  }

  const escribir = formato === 'json' ? escribirJson : escribirLegible;

  return function registroPeticiones(req, res, siguiente) {
    // `hrtime` y no `Date.now()`: un ajuste de reloj durante la petición no debe
    // producir tiempos de respuesta negativos.
    const inicio = process.hrtime.bigint();

    // `finish` y no `close`: `close` dispara también cuando el cliente aborta y
    // produciría entradas con un código de estado que nunca se envió.
    res.on('finish', () => {
      const duracionMs = Number(process.hrtime.bigint() - inicio) / NS_POR_MS;

      escribir({
        instante: new Date().toISOString(),
        metodo: req.method,
        // `originalUrl` y no la plantilla de la ruta: conserva la cadena de
        // consulta, y en el momento de `finish` la plantilla puede no existir
        // (una petición rechazada por el límite nunca resolvió ruta).
        ruta: req.originalUrl,
        estado: res.statusCode,
        duracionMs: Number(duracionMs.toFixed(DECIMALES_MS)),
        ip: req.ip,
        // Se lee aquí y no al entrar: este middleware va muy por delante de
        // `requiereAutenticacion`, pero en `finish` el usuario ya está puesto si
        // la ruta estaba protegida. Solo el identificador, nunca el email.
        usuarioId: req.usuario?.id ?? null,
        // Solo la presencia de la cabecera, jamás su contenido.
        autenticacion: Boolean(req.get('authorization')),
      });
    });

    siguiente();
  };
}

/** Una línea alineada, pensada para leerse en una terminal. */
function escribirLegible(entrada) {
  const usuario = entrada.usuarioId === null ? 'anónimo' : `usuario=${entrada.usuarioId}`;
  const linea =
    `${entrada.instante} ` +
    `${entrada.metodo.padEnd(ANCHO_METODO)} ` +
    `${String(entrada.estado).padStart(ANCHO_ESTADO)} ` +
    `${entrada.duracionMs.toFixed(DECIMALES_MS).padStart(7)}ms ` +
    `${entrada.ruta} ` +
    `ip=${entrada.ip} ${usuario} auth=${entrada.autenticacion}`;

  process.stdout.write(`${linea}\n`);
}

/**
 * Una única línea por entrada. `process.stdout.write` con un `\n` explícito y no
 * `console.log`, para no depender de cómo `console` decide formatear un objeto,
 * y una sola línea y no JSON indentado, que ningún agregador sabe leer por líneas.
 */
function escribirJson(entrada) {
  process.stdout.write(`${JSON.stringify(entrada)}\n`);
}
