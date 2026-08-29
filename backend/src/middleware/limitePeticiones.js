import { errorDemasiadasPeticiones } from '../utils/errores.js';

const MS_POR_SEGUNDO = 1000;

/**
 * Fábrica de limitadores por ventana fija. Cada llamada devuelve un middleware
 * con su propio `Map` de contadores, cerrado sobre esta función: no hay ningún
 * estado a nivel de módulo, de modo que el límite general y el reforzado del
 * inicio de sesión cuentan por separado aunque ambos evalúen la misma petición.
 *
 * El estado por clave es `{ contador, reinicioEn }`: dos enteros por IP, frente
 * a la lista de marcas de tiempo que exigiría una ventana deslizante y cuyo
 * tamaño elegiría el atacante.
 *
 * Se usa `Map` y no un objeto plano porque la clave es una cadena que controla
 * el cliente (su IP tal como la reporta Express) y un `Map` no tiene prototipo
 * que envenenar con una clave `__proto__`.
 *
 * @param {{ ventanaMs: number, maximo: number }} opciones
 * @returns {import('express').RequestHandler}
 */
export function crearLimitePeticiones({ ventanaMs, maximo }) {
  const contadores = new Map();

  // Sin purga, el mapa crece con cada IP vista y no baja nunca: una fuga de
  // memoria dirigible desde fuera. El barrido periódico es preferible a purgar
  // en cada petición, que convertiría un O(1) en O(n) justo cuando n es grande.
  // `unref()` evita que el temporizador impida al proceso terminar.
  const barrido = setInterval(() => {
    const ahora = Date.now();
    for (const [clave, entrada] of contadores) {
      if (ahora >= entrada.reinicioEn) {
        contadores.delete(clave);
      }
    }
  }, ventanaMs);
  barrido.unref();

  return function limitePeticiones(req, res, siguiente) {
    const clave = req.ip;
    const ahora = Date.now();
    const entrada = contadores.get(clave);

    let estado;
    if (entrada === undefined || ahora >= entrada.reinicioEn) {
      estado = { contador: 1, reinicioEn: ahora + ventanaMs };
      contadores.set(clave, estado);
    } else {
      entrada.contador += 1;
      estado = entrada;
    }

    const restantes = Math.max(0, maximo - estado.contador);
    // Los segundos restantes y no un instante absoluto: así el cliente no
    // depende de que su reloj esté en hora.
    const segundosHastaReinicio = Math.ceil((estado.reinicioEn - ahora) / MS_POR_SEGUNDO);

    res.set('RateLimit-Limit', String(maximo));
    res.set('RateLimit-Remaining', String(restantes));
    res.set('RateLimit-Reset', String(segundosHastaReinicio));

    if (estado.contador > maximo) {
      res.set('Retry-After', String(segundosHastaReinicio));
      // No responde aquí: `manejadorErrores` es el único punto del sistema que
      // construye una respuesta de error, y así el 429 tiene exactamente la
      // misma forma que cualquier otro error de la API.
      return siguiente(errorDemasiadasPeticiones());
    }

    return siguiente();
  };
}
