import { useContext } from 'react';
import { ContextoAuth } from '../contextos/ContextoAuth.jsx';

/**
 * Vía única de acceso al estado de sesión. Existe para que ningún componente
 * importe el objeto de contexto directamente ni lea el token del navegador.
 */
export function useAuth() {
  const contexto = useContext(ContextoAuth);

  // Sin esta comprobación, el fallo aparecería más tarde y en otro sitio, como
  // una lectura de propiedad sobre null, que no dice cuál es el problema.
  if (contexto === null) {
    throw new Error('useAuth debe usarse dentro de <ProveedorAuth>.');
  }

  return contexto;
}
