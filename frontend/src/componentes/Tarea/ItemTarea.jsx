import { useId, useState } from 'react';
import { MensajeError } from '../Comunes/MensajeError.jsx';
import { ErrorApi } from '../../servicios/api.js';
import estilos from './ItemTarea.module.css';

/**
 * Fila de una tarea. Muestra título, chip de categoría (solo si la tiene),
 * prioridad, fecha de vencimiento (solo si la hay) y chips de etiquetas, y
 * ofrece completar / editar / eliminar mediante los callbacks recibidos.
 *
 * El identificador se trata siempre como cadena: viene así del backend por ser
 * un entero de 64 bits y nunca se convierte a número.
 */
export function ItemTarea({ tarea, alEditar, alEliminar, alCambiarCompletada }) {
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState(null);
  const idEstado = useId();

  const tieneCategoria = Boolean(tarea.categoria && tarea.categoria.id);
  const etiquetas = Array.isArray(tarea.etiquetas) ? tarea.etiquetas : [];

  async function alternarCompletada() {
    if (procesando) {
      return;
    }
    // El booleano deseado se calcula una sola vez sobre el dato renderizado.
    const objetivo = !tarea.completada;
    setProcesando(true);
    setError(null);
    try {
      await alCambiarCompletada(String(tarea.id), objetivo);
    } catch (err) {
      setError(err instanceof ErrorApi
        ? err.mensaje
        : 'No se ha podido cambiar el estado de la tarea. Inténtalo de nuevo.');
    } finally {
      setProcesando(false);
    }
  }

  return (
    <li className={tarea.completada ? estilos.filaCompletada : estilos.fila}>
      <div className={estilos.principal}>
        <input
          type="checkbox"
          className={estilos.check}
          checked={Boolean(tarea.completada)}
          onChange={alternarCompletada}
          disabled={procesando}
          aria-describedby={idEstado}
          aria-label={tarea.completada ? 'Marcar como no completada' : 'Marcar como completada'}
        />
        <div className={estilos.cuerpo}>
          <span className={estilos.titulo}>{tarea.titulo}</span>
          <div className={estilos.meta}>
            <span className={estilos.prioridad}>{tarea.prioridad}</span>
            {tarea.fecha_vencimiento && (
              <span className={estilos.fecha}>Vence: {tarea.fecha_vencimiento}</span>
            )}
            {tieneCategoria && (
              <span className={estilos.chipCategoria}>{tarea.categoria.nombre}</span>
            )}
          </div>
          {etiquetas.length > 0 && (
            <ul className={estilos.etiquetas}>
              {etiquetas.map((etiqueta) => (
                <li key={String(etiqueta.id)} className={estilos.chipEtiqueta}>
                  {etiqueta.nombre}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={estilos.acciones}>
        <button
          className={estilos.botonSecundario}
          type="button"
          onClick={() => alEditar?.(tarea)}
        >
          Editar
        </button>
        <button
          className={estilos.botonSecundario}
          type="button"
          onClick={() => alEliminar?.(tarea)}
        >
          Eliminar
        </button>
      </div>

      <span id={idEstado} className={estilos.oculto}>
        {tarea.completada ? 'Completada' : 'Pendiente'}
      </span>
      <MensajeError>{error}</MensajeError>
    </li>
  );
}
