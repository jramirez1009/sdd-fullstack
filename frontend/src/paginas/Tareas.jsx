import { useAuth } from '../hooks/useAuth.js';
import estilos from './Tareas.module.css';

/**
 * Destino mínimo de este cambio: sirve para verificar que el registro y el
 * inicio de sesión llevan a la pantalla principal y que se puede cerrar sesión
 * desde una pantalla protegida. Su contenido real llega en el cambio siguiente.
 */
export function Tareas() {
  const { usuario, cerrarSesion } = useAuth();

  return (
    <main className={estilos.pantalla}>
      <header className={estilos.cabecera}>
        <div>
          <h1 className={estilos.titulo}>Tus tareas</h1>
          <p className={estilos.saludo}>
            Hola, {usuario?.nombre ?? usuario?.email}.
          </p>
        </div>
        {/*
          No se navega a mano tras cerrar sesión: al vaciarse el estado, el
          guardián de rutas deja de dejar pasar y redirige a /login por sí solo.
        */}
        <button className={estilos.boton} type="button" onClick={() => cerrarSesion()}>
          Cerrar sesión
        </button>
      </header>

      <p className={estilos.pendiente}>
        Aquí aparecerá la lista de tareas.
      </p>
    </main>
  );
}
