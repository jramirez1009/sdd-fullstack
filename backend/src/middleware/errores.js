import { CODIGOS_ERROR, ErrorAplicacion, errorNoEncontrado } from '../utils/errores.js';

/**
 * Manejador de rutas no encontradas. Va montado después de todas las rutas y
 * antes del middleware de errores, para que un 404 tenga el mismo formato de
 * respuesta que cualquier otro error.
 */
export function manejadorNoEncontrado(req, _res, siguiente) {
  siguiente(errorNoEncontrado(`No existe el recurso ${req.method} ${req.originalUrl}.`));
}

/**
 * Middleware de error final: es el único punto del sistema que construye una
 * respuesta de error, para que el formato no diverja endpoint a endpoint.
 *
 * Forma de la respuesta: { error: { codigo, mensaje, detalles? } }
 */
// eslint-disable-next-line no-unused-vars -- Express identifica el manejador de
// errores por su aridad de cuatro argumentos.
export function manejadorErrores(error, req, res, _siguiente) {
  if (error instanceof ErrorAplicacion) {
    const cuerpo = { codigo: error.codigo, mensaje: error.message };
    if (error.detalles !== undefined) {
      cuerpo.detalles = error.detalles;
    }
    return res.status(error.estadoHttp).json({ error: cuerpo });
  }

  // JSON mal formado en el cuerpo: express.json() lo señala así. Es culpa del
  // cliente, no un fallo del servidor.
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({
      error: {
        codigo: CODIGOS_ERROR.DATOS_INVALIDOS,
        mensaje: 'El cuerpo de la petición no es JSON válido.',
      },
    });
  }

  // Cualquier otro error es un fallo no previsto: el detalle técnico (traza de
  // pila, mensaje del driver de base de datos) queda solo en el servidor.
  console.error(`Error no controlado en ${req.method} ${req.originalUrl}:`, error);

  return res.status(500).json({
    error: {
      codigo: CODIGOS_ERROR.ERROR_INTERNO,
      mensaje: 'Se produjo un error inesperado. Inténtalo de nuevo más tarde.',
    },
  });
}
