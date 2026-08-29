/**
 * Validación del cliente: existe para dar respuesta inmediata y ahorrar un
 * viaje, no para duplicar las reglas de negocio. La autoridad sigue siendo la
 * API. Por eso solo se comprueban presencia, forma del email y longitud de la
 * contraseña, y nada más: una segunda copia de las reglas se desincroniza en
 * cuanto cambie una de las dos.
 *
 * Devuelve un objeto `{ campo: motivo }` con la misma forma que los `detalles`
 * de un `DATOS_INVALIDOS`, para que los formularios pinten los errores por
 * campo desde una única estructura venga de donde venga.
 */

// Espejo del límite del backend, que lo impone bcrypt.
export const LONGITUD_MINIMA_PASSWORD = 8;
export const LONGITUD_MAXIMA_PASSWORD = 72;

// Misma comprobación de forma que el backend: parte local, arroba, dominio con
// al menos un punto y sin espacios. No comprueba que la dirección exista.
const PATRON_EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/**
 * Longitud en bytes UTF-8, no en unidades de UTF-16. El límite del backend se
 * cuenta en bytes y una letra acentuada ocupa dos: con `.length` se aceptarían
 * contraseñas que la API rechaza.
 */
function bytesUtf8(texto) {
  return new TextEncoder().encode(texto).length;
}

/** Motivo por el que el email no vale, o null si vale. */
export function validarEmail(email) {
  const valor = typeof email === 'string' ? email.trim() : '';
  if (valor === '') {
    return 'El email es obligatorio.';
  }
  if (!PATRON_EMAIL.test(valor)) {
    return 'El email no tiene un formato válido.';
  }
  return null;
}

/** Motivo por el que la contraseña no vale, o null si vale. */
export function validarPassword(password) {
  if (typeof password !== 'string' || password === '') {
    return 'La contraseña es obligatoria.';
  }
  const bytes = bytesUtf8(password);
  if (bytes < LONGITUD_MINIMA_PASSWORD) {
    return `La contraseña debe tener al menos ${LONGITUD_MINIMA_PASSWORD} caracteres.`;
  }
  if (bytes > LONGITUD_MAXIMA_PASSWORD) {
    return `La contraseña no puede superar los ${LONGITUD_MAXIMA_PASSWORD} bytes (las letras acentuadas ocupan dos).`;
  }
  return null;
}

/**
 * Valida el formulario de registro. Aplica las reglas de longitud porque la
 * cuenta se está creando ahora.
 */
export function validarRegistro({ email, password }) {
  const detalles = {};

  const problemaEmail = validarEmail(email);
  if (problemaEmail) {
    detalles.email = problemaEmail;
  }

  const problemaPassword = validarPassword(password);
  if (problemaPassword) {
    detalles.password = problemaPassword;
  }

  return detalles;
}

/**
 * Valida el formulario de inicio de sesión. Solo comprueba presencia, igual que
 * el backend: aplicar aquí las reglas de longitud impediría entrar a quien se
 * registró cuando esas reglas eran otras.
 */
export function validarLogin({ email, password }) {
  const detalles = {};

  if (typeof email !== 'string' || email.trim() === '') {
    detalles.email = 'El email es obligatorio.';
  }

  if (typeof password !== 'string' || password === '') {
    detalles.password = 'La contraseña es obligatoria.';
  }

  return detalles;
}
