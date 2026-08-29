import { useEffect, useId, useRef, useState } from 'react';
import { Cargando } from '../Comunes/Cargando.jsx';
import { MensajeError } from '../Comunes/MensajeError.jsx';
import { ErrorApi } from '../../servicios/api.js';
import estilos from './DialogoConfirmarBorrado.module.css';

const SELECTOR_FOCO = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Confirmación de borrado de una categoría. No usa `window.confirm`: necesita el
 * texto accesible sobre el efecto en las tareas y encajar con CSS Modules.
 *
 * `Esc` y "Cancelar" cierran sin llamar a la API. Al confirmar se invoca
 * `alConfirmar(id)`; mientras la promesa está pendiente el botón "Eliminar"
 * queda deshabilitado y se muestra `<Cargando>`. Si rechaza, el motivo se
 * muestra con `<MensajeError>` y se puede reintentar.
 */
export function DialogoConfirmarBorrado({ categoria, alConfirmar, alCancelar }) {
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState(null);
  const enVuelo = useRef(false);
  const panelRef = useRef(null);

  const idTitulo = useId();
  const idDescripcion = useId();

  // Foco atrapado mientras el diálogo está abierto, más cierre con `Esc`.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) {
      return undefined;
    }

    const focoPrevio = document.activeElement;
    const foco = panel.querySelectorAll(SELECTOR_FOCO);
    foco[0]?.focus();

    const alPulsarTecla = (evento) => {
      if (evento.key === 'Escape') {
        alCancelar?.();
        return;
      }
      if (evento.key !== 'Tab' || foco.length === 0) {
        return;
      }
      const primero = foco[0];
      const ultimo = foco[foco.length - 1];
      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    };

    document.addEventListener('keydown', alPulsarTecla);
    return () => {
      document.removeEventListener('keydown', alPulsarTecla);
      if (focoPrevio instanceof HTMLElement) {
        focoPrevio.focus();
      }
    };
  }, [alCancelar]);

  async function confirmar() {
    if (enVuelo.current) {
      return;
    }
    enVuelo.current = true;
    setEliminando(true);
    setError(null);
    try {
      await alConfirmar(categoria.id);
      // El contenedor cierra el diálogo al reconciliarse la lista.
    } catch (err) {
      setError(err instanceof ErrorApi
        ? err.mensaje
        : 'No se ha podido eliminar la categoría. Inténtalo de nuevo.');
    } finally {
      enVuelo.current = false;
      setEliminando(false);
    }
  }

  return (
    <div className={estilos.fondo} role="presentation" onClick={() => alCancelar?.()}>
      <div
        ref={panelRef}
        className={estilos.panel}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={idDescripcion}
        onClick={(evento) => evento.stopPropagation()}
      >
        <h2 className={estilos.titulo} id={idTitulo}>Eliminar categoría</h2>
        <p className={estilos.descripcion} id={idDescripcion}>
          Se eliminará la categoría <strong>{categoria.nombre}</strong>. Las tareas
          asociadas no se borran: quedarán sin categoría.
        </p>

        <MensajeError>{error}</MensajeError>

        <div className={estilos.acciones}>
          <button
            className={estilos.botonPeligro}
            type="button"
            onClick={confirmar}
            disabled={eliminando}
          >
            {eliminando ? 'Eliminando…' : 'Eliminar'}
          </button>
          <button
            className={estilos.botonSecundario}
            type="button"
            onClick={() => alCancelar?.()}
            disabled={eliminando}
          >
            Cancelar
          </button>
        </div>

        {eliminando && <Cargando texto="Eliminando…" />}
      </div>
    </div>
  );
}
