import { useId, useRef, useState } from 'react';
import { Cargando } from '../Comunes/Cargando.jsx';
import { MensajeError } from '../Comunes/MensajeError.jsx';
import { ErrorApi } from '../../servicios/api.js';
import estilos from './FormularioCategoria.module.css';

/** Límite de longitud del backend; se usa solo como ayuda de UX en el input. */
const LONGITUD_MAXIMA_NOMBRE = 100;

/**
 * Único formulario para crear y renombrar una categoría. Opera en modo crear si
 * no recibe `categoria` y en modo editar si la recibe (parte de su nombre).
 *
 * El único dato editable es el nombre. La validación de cliente se limita a
 * "no vacío"; la autoridad sobre la validez es la API. El conflicto de nombre
 * duplicado (`NOMBRE_DUPLICADO`) y el `DATOS_INVALIDOS` con `detalles.nombre` se
 * muestran pegados al campo; cualquier otro fallo, con `<MensajeError>` genérico.
 */
export function FormularioCategoria({ categoria = null, alCrear, alEditar, alGuardar, alCancelar }) {
  const modo = categoria ? 'editar' : 'crear';

  const [nombre, setNombre] = useState(categoria?.nombre ?? '');
  const [errorNombre, setErrorNombre] = useState(null);
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);
  // El estado de React no cambia dentro del mismo turno del bucle de eventos:
  // la referencia sí, y es lo que impide que un doble envío genere dos
  // peticiones.
  const enVuelo = useRef(false);

  const idCampo = useId();
  const idError = `${idCampo}-error`;

  async function alEnviar(evento) {
    evento.preventDefault();

    if (enVuelo.current) {
      return;
    }

    setErrorGeneral(null);
    setErrorNombre(null);

    if (nombre.trim() === '') {
      setErrorNombre('Escribe un nombre para la categoría.');
      return;
    }

    enVuelo.current = true;
    setEnviando(true);
    try {
      if (modo === 'editar') {
        await alEditar(categoria.id, nombre.trim());
      } else {
        await alCrear(nombre.trim());
      }
      alGuardar?.();
    } catch (err) {
      if (err instanceof ErrorApi && err.codigo === 'NOMBRE_DUPLICADO') {
        setErrorNombre('Ya tienes una categoría con ese nombre. Elige otro.');
      } else if (err instanceof ErrorApi && err.codigo === 'DATOS_INVALIDOS') {
        setErrorNombre(err.detalles?.nombre ?? 'El nombre no es válido.');
      } else if (err instanceof ErrorApi) {
        setErrorGeneral(err.mensaje);
      } else {
        setErrorGeneral('Se produjo un error inesperado. Inténtalo de nuevo más tarde.');
      }
      // Lo escrito se conserva para que la persona corrija sin volver a empezar.
    } finally {
      enVuelo.current = false;
      setEnviando(false);
    }
  }

  return (
    <form className={estilos.formulario} onSubmit={alEnviar} noValidate>
      <h2 className={estilos.titulo}>
        {modo === 'editar' ? 'Renombrar categoría' : 'Nueva categoría'}
      </h2>

      <MensajeError>{errorGeneral}</MensajeError>

      <div className={estilos.campo}>
        <label className={estilos.etiqueta} htmlFor={idCampo}>Nombre</label>
        <input
          id={idCampo}
          name="nombre"
          type="text"
          className={errorNombre ? estilos.entradaInvalida : estilos.entrada}
          value={nombre}
          onChange={(evento) => setNombre(evento.target.value)}
          maxLength={LONGITUD_MAXIMA_NOMBRE}
          autoFocus
          aria-invalid={errorNombre ? 'true' : undefined}
          aria-describedby={errorNombre ? idError : undefined}
        />
        {errorNombre && (
          <span className={estilos.errorCampo} id={idError}>{errorNombre}</span>
        )}
      </div>

      <div className={estilos.acciones}>
        <button className={estilos.boton} type="submit" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar'}
        </button>
        <button
          className={estilos.botonSecundario}
          type="button"
          onClick={() => alCancelar?.()}
          disabled={enviando}
        >
          Cancelar
        </button>
      </div>

      {enviando && <Cargando texto="Guardando…" />}
    </form>
  );
}
