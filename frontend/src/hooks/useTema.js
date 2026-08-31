import { useContext } from 'react';
import { ContextoTema } from '../contexto/ContextoTema.jsx';

/**
 * Vía única de acceso a la preferencia de tema. Existe para que ningún
 * componente importe el objeto de contexto directamente ni lea el tema del
 * navegador por su cuenta.
 */
export function useTema() {
  const contexto = useContext(ContextoTema);

  // Sin esta comprobación, el fallo aparecería más tarde y en otro sitio, como
  // una lectura de propiedad sobre null, que no dice cuál es el problema.
  if (contexto === null) {
    throw new Error('useTema debe usarse dentro de <ProveedorTema>.');
  }

  return contexto;
}
