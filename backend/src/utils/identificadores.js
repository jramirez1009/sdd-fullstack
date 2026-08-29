import { errorDatosInvalidos } from './errores.js';

// Enteros positivos sin signo, sin ceros a la izquierda y sin parte decimal.
// El 0 queda fuera porque la secuencia de identidad de PostgreSQL empieza en 1.
const PATRON_ID = /^[1-9][0-9]*$/;

/**
 * Valida un identificador tomado de la ruta y lo devuelve como cadena.
 *
 * Se devuelve cadena, nunca número: las claves son BIGINT y el valor puede
 * exceder la precisión de un número de JavaScript, de modo que convertirlo
 * apuntaría en silencio a otra fila. `pg` envía el parámetro tal cual y
 * PostgreSQL lo compara como BIGINT.
 *
 * Se valida antes de consultar porque pasar "abc" a una comparación con BIGINT
 * provoca el error 22P02 del driver, que llegaría al manejador como fallo no
 * previsto y respondería 500 a lo que es un error del cliente.
 */
export function parsearIdRuta(valor) {
  if (typeof valor !== 'string' || !PATRON_ID.test(valor)) {
    throw errorDatosInvalidos({ id: 'El identificador debe ser un entero positivo.' });
  }
  return valor;
}
