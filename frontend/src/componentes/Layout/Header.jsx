import { useAuth } from '../../hooks/useAuth.js';
import estilos from './Header.module.css';

/**
 * Cabecera del armazón: identifica a la persona autenticada y ofrece cerrar
 * sesión. No navega tras cerrar sesión —al vaciarse el estado, `RutaProtegida`
 * deja de dejar pasar y redirige a `/login` por sí solo.
 *
 * En pantalla estrecha muestra el botón de menú, que alterna el panel de
 * navegación gobernado por `Layout`.
 */
export function Header({ panelAbierto, alAlternarPanel, idPanel }) {
  const { usuario, cerrarSesion } = useAuth();

  return (
    <header className={estilos.cabecera}>
      <div className={estilos.izquierda}>
        <button
          className={estilos.botonMenu}
          type="button"
          aria-expanded={panelAbierto}
          aria-controls={idPanel}
          onClick={alAlternarPanel}
        >
          <span className={estilos.iconoMenu} aria-hidden="true" />
          Menú
        </button>
        <span className={estilos.marca}>Lista de tareas</span>
      </div>

      <div className={estilos.derecha}>
        <span className={estilos.identidad}>
          {usuario?.nombre ?? usuario?.email}
        </span>
        <button
          className={estilos.botonSalir}
          type="button"
          onClick={() => cerrarSesion()}
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
