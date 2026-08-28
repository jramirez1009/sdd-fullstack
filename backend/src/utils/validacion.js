const LONGITUD_MINIMA_PASSWORD = 8;
// bcrypt ignora los bytes que exceden 72: aceptar una contraseña más larga haría
// que dos contraseñas distintas abrieran la misma cuenta. Se rechaza en lugar de
// truncar en silencio.
const LONGITUD_MAXIMA_PASSWORD = 72;
const LONGITUD_MAXIMA_NOMBRE = 100;
const LONGITUD_MAXIMA_EMAIL = 254;

// Comprobación de forma, no de existencia: parte local, arroba, dominio con al
// menos un punto y sin espacios.
const PATRON_EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

function esCadenaNoVacia(valor) {
  return typeof valor === 'string' && valor.trim() !== '';
}

/**
 * Valida los datos de `POST /api/auth/registro`.
 * Devuelve { valido, detalles, datos }: `detalles` enumera los campos inválidos
 * y `datos` trae los valores ya normalizados cuando la validación pasa.
 */
export function validarRegistro(cuerpo) {
  const entrada = cuerpo ?? {};
  const detalles = {};

  const email = typeof entrada.email === 'string' ? entrada.email.trim() : entrada.email;
  if (!esCadenaNoVacia(email)) {
    detalles.email = 'El email es obligatorio.';
  } else if (email.length > LONGITUD_MAXIMA_EMAIL) {
    detalles.email = `El email no puede superar los ${LONGITUD_MAXIMA_EMAIL} caracteres.`;
  } else if (!PATRON_EMAIL.test(email)) {
    detalles.email = 'El email no tiene un formato válido.';
  }

  const problemaPassword = validarPassword(entrada.password);
  if (problemaPassword) {
    detalles.password = problemaPassword;
  }

  // El nombre es opcional: ausente o null es válido. Si viene, debe ser una
  // cadena con contenido, porque la cadena vacía sería un tercer estado
  // indistinguible de "sin nombre".
  let nombre = null;
  if (entrada.nombre !== undefined && entrada.nombre !== null) {
    if (typeof entrada.nombre !== 'string') {
      detalles.nombre = 'El nombre debe ser texto.';
    } else {
      const recortado = entrada.nombre.trim();
      if (recortado === '') {
        detalles.nombre = 'El nombre, si se envía, no puede estar vacío.';
      } else if (recortado.length > LONGITUD_MAXIMA_NOMBRE) {
        detalles.nombre = `El nombre no puede superar los ${LONGITUD_MAXIMA_NOMBRE} caracteres.`;
      } else {
        nombre = recortado;
      }
    }
  }

  const valido = Object.keys(detalles).length === 0;
  return {
    valido,
    detalles,
    datos: valido ? { email, password: entrada.password, nombre } : null,
  };
}

/**
 * Valida los datos de `POST /api/auth/login`. Solo comprueba presencia y forma:
 * no aplica las reglas de longitud de contraseña, para que un cambio futuro de
 * esas reglas no impida entrar a quien se registró con las anteriores.
 */
export function validarLogin(cuerpo) {
  const entrada = cuerpo ?? {};
  const detalles = {};

  const email = typeof entrada.email === 'string' ? entrada.email.trim() : entrada.email;
  if (!esCadenaNoVacia(email)) {
    detalles.email = 'El email es obligatorio.';
  }

  if (typeof entrada.password !== 'string' || entrada.password === '') {
    detalles.password = 'La contraseña es obligatoria.';
  }

  const valido = Object.keys(detalles).length === 0;
  return {
    valido,
    detalles,
    datos: valido ? { email, password: entrada.password } : null,
  };
}

/**
 * Regla de contraseña: entre 8 y 72 bytes en UTF-8, sin reglas de composición
 * (NIST SP 800-63B prioriza longitud sobre composición). El límite se cuenta en
 * bytes y no en caracteres porque una letra acentuada ocupa más de un byte.
 * Devuelve el problema encontrado, o null si es válida.
 */
export function validarPassword(password) {
  if (typeof password !== 'string' || password === '') {
    return 'La contraseña es obligatoria.';
  }

  const bytes = Buffer.byteLength(password, 'utf8');
  if (bytes < LONGITUD_MINIMA_PASSWORD) {
    return `La contraseña debe tener al menos ${LONGITUD_MINIMA_PASSWORD} caracteres.`;
  }
  if (bytes > LONGITUD_MAXIMA_PASSWORD) {
    return `La contraseña no puede superar los ${LONGITUD_MAXIMA_PASSWORD} bytes.`;
  }

  return null;
}

export { LONGITUD_MINIMA_PASSWORD, LONGITUD_MAXIMA_PASSWORD, LONGITUD_MAXIMA_NOMBRE };
