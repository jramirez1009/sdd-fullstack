import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { Cargando } from './Cargando.jsx';

/**
 * Guardián de las pantallas que exigen sesión. Aplica la tabla de decisión de
 * design.md § 2:
 *
 *   cargandoSesion → pinta Cargando y no decide todavía
 *   sin usuario    → lleva a /login
 *   con usuario    → deja pasar
 *
 * El tercer estado es lo que impide que una recarga con sesión válida expulse a
 * /login: en el primer render `usuario` todavía es null porque la comprobación
 * contra la API no ha respondido.
 */
export function RutaProtegida({ children }) {
  const { usuario, cargandoSesion } = useAuth();

  if (cargandoSesion) {
    return <Cargando texto="Comprobando tu sesión…" enPantallaCompleta />;
  }

  if (!usuario) {
    // `replace`: la dirección protegida no debe quedar en el historial, o el
    // botón de atrás devolvería a un intento que ya se sabe que no vale.
    return <Navigate to="/login" replace />;
  }

  return children;
}

/**
 * Contrapartida del anterior para las pantallas de autenticación: quien ya
 * tiene sesión no debe ver el formulario de inicio de sesión ni el de registro.
 */
export function RutaSoloAnonima({ children }) {
  const { usuario, cargandoSesion } = useAuth();

  if (cargandoSesion) {
    return <Cargando texto="Comprobando tu sesión…" enPantallaCompleta />;
  }

  if (usuario) {
    return <Navigate to="/tareas" replace />;
  }

  return children;
}
