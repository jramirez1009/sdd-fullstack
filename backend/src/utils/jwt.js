import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const ALGORITMO = 'HS256';

/**
 * Emite el token de sesión. El contenido se limita al identificador y al email
 * del usuario: ningún dato mutable adicional, para que un token no pueda quedar
 * desincronizado del estado real.
 */
export function emitirToken(usuario) {
  return jwt.sign({ sub: String(usuario.id), email: usuario.email }, env.JWT_SECRET, {
    algorithm: ALGORITMO,
    expiresIn: env.JWT_EXPIRACION,
  });
}

/**
 * Verifica firma y expiración. Lanza si el token no es válido; quien llama
 * decide cómo traducir el fallo.
 */
export function verificarToken(token) {
  const contenido = jwt.verify(token, env.JWT_SECRET, { algorithms: [ALGORITMO] });
  return {
    id: Number(contenido.sub),
    email: contenido.email,
    expiraEn: contenido.exp,
  };
}

export { ALGORITMO };
