import estilos from './Cargando.module.css';

/**
 * Estado de espera visible. Se anuncia como región activa (`role="status"`)
 * para que un lector de pantalla lea el cambio sin que el foco se mueva.
 */
export function Cargando({ texto = 'Cargando…', enPantallaCompleta = false }) {
  return (
    <div
      className={enPantallaCompleta ? estilos.pantallaCompleta : estilos.contenedor}
      role="status"
      aria-live="polite"
    >
      <span className={estilos.indicador} aria-hidden="true" />
      <span className={estilos.texto}>{texto}</span>
    </div>
  );
}
