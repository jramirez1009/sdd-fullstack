import estilos from './MensajeError.module.css';

/**
 * Representación visible de un fallo. `tono` distingue el error propiamente
 * dicho del aviso —por ejemplo, la sesión caducada—, que no es un fallo de lo
 * que la persona acaba de hacer.
 *
 * `role="alert"` en los errores porque interrumpen la tarea en curso;
 * `role="status"` en los avisos, que solo informan.
 */
export function MensajeError({ children, tono = 'error', id }) {
  if (!children) {
    return null;
  }

  const esAviso = tono === 'aviso';

  return (
    <p
      id={id}
      className={esAviso ? estilos.aviso : estilos.error}
      role={esAviso ? 'status' : 'alert'}
    >
      {children}
    </p>
  );
}
