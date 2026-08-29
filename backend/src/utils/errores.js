/**
 * Códigos de error estables que la API expone al cliente. El frontend decide su
 * comportamiento por el código y nunca por el texto del mensaje, de modo que
 * reescribir un mensaje no rompa la interfaz.
 */
export const CODIGOS_ERROR = {
  DATOS_INVALIDOS: 'DATOS_INVALIDOS',
  EMAIL_DUPLICADO: 'EMAIL_DUPLICADO',
  CREDENCIALES_INVALIDAS: 'CREDENCIALES_INVALIDAS',
  NO_AUTENTICADO: 'NO_AUTENTICADO',
  NOMBRE_DUPLICADO: 'NOMBRE_DUPLICADO',
  NO_ENCONTRADO: 'NO_ENCONTRADO',
  ERROR_INTERNO: 'ERROR_INTERNO',
};

/**
 * Error de negocio previsto: lleva su estado HTTP y su código estable, de modo
 * que el middleware de errores pueda traducirlo sin interpretar el mensaje.
 */
export class ErrorAplicacion extends Error {
  constructor(estadoHttp, codigo, mensaje, detalles) {
    super(mensaje);
    this.name = 'ErrorAplicacion';
    this.estadoHttp = estadoHttp;
    this.codigo = codigo;
    if (detalles !== undefined) {
      this.detalles = detalles;
    }
    Error.captureStackTrace?.(this, ErrorAplicacion);
  }
}

export function errorDatosInvalidos(detalles, mensaje = 'Los datos enviados no son válidos.') {
  return new ErrorAplicacion(400, CODIGOS_ERROR.DATOS_INVALIDOS, mensaje, detalles);
}

export function errorEmailDuplicado() {
  return new ErrorAplicacion(409, CODIGOS_ERROR.EMAIL_DUPLICADO, 'Ya existe una cuenta con ese email.');
}

export function errorCredencialesInvalidas() {
  // Mensaje deliberadamente genérico: no debe revelar si el email existe.
  return new ErrorAplicacion(401, CODIGOS_ERROR.CREDENCIALES_INVALIDAS, 'Email o contraseña incorrectos.');
}

/**
 * Nombre ya usado por el mismo usuario en ese recurso. `recurso` viaja en
 * `detalles` y no en el código: la reacción del frontend es la misma para
 * categorías y etiquetas, así que un código por recurso solo engordaría el
 * catálogo. El mensaje no menciona la restricción ni la tabla que lo detectó.
 */
export function errorNombreDuplicado(recurso) {
  return new ErrorAplicacion(
    409,
    CODIGOS_ERROR.NOMBRE_DUPLICADO,
    'Ya tienes un elemento con ese nombre.',
    { recurso },
  );
}

export function errorNoAutenticado(mensaje = 'Se requiere autenticación para acceder a este recurso.') {
  return new ErrorAplicacion(401, CODIGOS_ERROR.NO_AUTENTICADO, mensaje);
}

export function errorNoEncontrado(mensaje = 'El recurso solicitado no existe.') {
  return new ErrorAplicacion(404, CODIGOS_ERROR.NO_ENCONTRADO, mensaje);
}
