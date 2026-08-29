import estilos from './Tareas.module.css';

/**
 * Destino mínimo de este cambio. La cabecera y el cierre de sesión los aporta
 * ahora `Header` dentro de `Layout`; esta pantalla solo pone su contenido. Su
 * contenido real llega en `add-frontend-tareas`.
 */
export function Tareas() {
  return (
    <section className={estilos.pantalla}>
      <h1 className={estilos.titulo}>Tus tareas</h1>
      <p className={estilos.pendiente}>
        Aquí aparecerá la lista de tareas.
      </p>
    </section>
  );
}
