import { Component } from 'react';
import estilos from './LimiteDeError.module.css';

/**
 * Límite de error sobre el árbol principal. React solo expone esta API a través
 * de un componente de clase: `getDerivedStateFromError` cambia al render de
 * fallback y `componentDidCatch` es el punto único donde se registra el error.
 *
 * No captura errores de manejadores de eventos ni de código asíncrono —esos los
 * cubre `MensajeError`— ni errores del propio render de este fallback.
 */
export class LimiteDeError extends Component {
  state = { hayError: false };

  static getDerivedStateFromError() {
    return { hayError: true };
  }

  componentDidCatch(error, info) {
    // Solo en desarrollo: en producción no se vuelca nada a la consola del
    // usuario final.
    if (import.meta.env.DEV) {
      console.error('Error capturado por LimiteDeError:', error, info);
    }
  }

  render() {
    if (!this.state.hayError) {
      return this.props.children;
    }

    return (
      <div className={estilos.pantalla} role="alert">
        <div className={estilos.tarjeta}>
          <h1 className={estilos.titulo}>Algo ha ido mal</h1>
          <p className={estilos.texto}>
            La aplicación ha encontrado un problema inesperado. Puedes recargar
            la página o volver al inicio para continuar.
          </p>
          <div className={estilos.acciones}>
            <button
              className={estilos.botonPrimario}
              type="button"
              onClick={() => window.location.reload()}
            >
              Recargar
            </button>
            <button
              className={estilos.boton}
              type="button"
              onClick={() => window.location.assign('/')}
            >
              Ir al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }
}
