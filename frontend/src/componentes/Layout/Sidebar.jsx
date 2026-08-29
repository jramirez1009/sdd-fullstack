import { NavLink } from 'react-router-dom';
import estilos from './Sidebar.module.css';

/**
 * Navegación lateral entre las secciones autenticadas. El enlace a etiquetas se
 * añadirá en su cambio, cuando esa ruta exista.
 *
 * `NavLink` marca la sección activa (`aria-current="page"`). `alNavegar` se
 * invoca al elegir un destino para que `Layout` cierre el panel en móvil.
 */
const SECCIONES = [
  { a: '/tareas', texto: 'Tareas' },
  { a: '/categorias', texto: 'Categorías' },
];

export function Sidebar({ alNavegar }) {
  return (
    <nav className={estilos.navegacion} aria-label="Secciones de la aplicación">
      <ul className={estilos.lista}>
        {SECCIONES.map((seccion) => (
          <li key={seccion.a}>
            <NavLink
              to={seccion.a}
              className={({ isActive }) =>
                isActive ? `${estilos.enlace} ${estilos.enlaceActivo}` : estilos.enlace
              }
              onClick={() => alNavegar?.()}
            >
              {seccion.texto}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
