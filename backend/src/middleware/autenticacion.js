import { verificarToken } from '../utils/jwt.js';
import { errorNoAutenticado } from '../utils/errores.js';

const ESQUEMA = 'Bearer';

/**
 * Único punto del sistema donde se verifica un JWT. Deja la identidad del
 * usuario en `req.usuario` y corta la cadena con 401 ante cualquier fallo —sin
 * cabecera, cabecera mal formada, firma inválida o token expirado— de modo que
 * el manejador siguiente no llega a ejecutarse.
 */
export function requiereAutenticacion(req, _res, siguiente) {
  const cabecera = req.get('authorization');

  if (!cabecera) {
    return siguiente(errorNoAutenticado('Falta la cabecera Authorization.'));
  }

  const partes = cabecera.split(' ');
  if (partes.length !== 2 || partes[0] !== ESQUEMA || partes[1].trim() === '') {
    return siguiente(errorNoAutenticado('La cabecera Authorization debe seguir el esquema "Bearer <token>".'));
  }

  try {
    const { id, email } = verificarToken(partes[1]);
    req.usuario = { id, email };
    return siguiente();
  } catch {
    // Firma inválida, token manipulado o expirado se responden igual: el motivo
    // exacto no aporta nada al cliente legítimo y sí a quien prueba tokens.
    return siguiente(errorNoAutenticado('El token no es válido o ha expirado.'));
  }
}
