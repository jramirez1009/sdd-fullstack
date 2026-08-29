const LONGITUD_MINIMA_PASSWORD = 8;
// bcrypt ignora los bytes que exceden 72: aceptar una contraseña más larga haría
// que dos contraseñas distintas abrieran la misma cuenta. Se rechaza en lugar de
// truncar en silencio.
const LONGITUD_MAXIMA_PASSWORD = 72;
const LONGITUD_MAXIMA_NOMBRE = 100;
const LONGITUD_MAXIMA_EMAIL = 254;
// Espejo exacto de los CHECK del esquema: categorias 1-100, etiquetas 1-50.
const LONGITUD_MAXIMA_NOMBRE_CATEGORIA = 100;
const LONGITUD_MAXIMA_NOMBRE_ETIQUETA = 50;

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


// Caracteres de control C0 y C1, incluidos el salto de línea y la tabulación. Un
// nombre es una etiqueta de una línea: un carácter de control ahí solo puede
// llegar por un pegado accidental o por un intento de ensuciar los registros.
const PATRON_CARACTERES_CONTROL = /\p{Cc}/u;

/**
 * Valida y normaliza el nombre de una categoría o de una etiqueta.
 *
 * La longitud se cuenta en puntos de código, no con `.length`, porque el CHECK
 * del esquema usa `char_length`: un emoji cuenta 1 en la base y 2 en UTF-16, así
 * que contar con `.length` rechazaría con 400 nombres que la base sí admite.
 *
 * La normalización a NFC es lo que impide que "café" compuesto y descompuesto
 * convivan como dos filas distintas: son cadenas diferentes para la restricción
 * UNIQUE, pero idénticas en pantalla.
 *
 * Devuelve { valido, detalles, datos } como el resto de validaciones.
 */
export function validarNombre(cuerpo, longitudMaxima) {
  const entrada = cuerpo ?? {};
  const detalles = {};
  let nombre = null;

  if (entrada.nombre === undefined || entrada.nombre === null) {
    detalles.nombre = 'El nombre es obligatorio.';
  } else if (typeof entrada.nombre !== 'string') {
    // Se distingue de la ausencia, como ya hace validarRegistro: quien envía un
    // número no ha olvidado el campo, lo ha enviado con el tipo equivocado.
    detalles.nombre = 'El nombre debe ser texto.';
  } else if (PATRON_CARACTERES_CONTROL.test(entrada.nombre)) {
    detalles.nombre = 'El nombre no puede contener saltos de línea ni caracteres de control.';
  } else {
    // Se recortan los extremos y se conservan los espacios interiores: reescribir
    // en silencio lo que alguien teclea es peor que respetarlo.
    const recortado = entrada.nombre.trim().normalize('NFC');
    if (recortado === '') {
      detalles.nombre = 'El nombre es obligatorio.';
    } else if ([...recortado].length > longitudMaxima) {
      detalles.nombre = `El nombre no puede superar los ${longitudMaxima} caracteres.`;
    } else {
      nombre = recortado;
    }
  }

  const valido = Object.keys(detalles).length === 0;
  return { valido, detalles, datos: valido ? { nombre } : null };
}

export {
  LONGITUD_MINIMA_PASSWORD,
  LONGITUD_MAXIMA_PASSWORD,
  LONGITUD_MAXIMA_NOMBRE,
  LONGITUD_MAXIMA_NOMBRE_CATEGORIA,
  LONGITUD_MAXIMA_NOMBRE_ETIQUETA,
};
