import { useId, useMemo, useRef, useState } from 'react';
import { MensajeError } from '../Comunes/MensajeError.jsx';
import { ErrorApi } from '../../servicios/api.js';
import { useEtiquetas } from '../../hooks/useEtiquetas.js';
import estilos from './AutocompletarEtiquetas.module.css';

/**
 * Campo de asignación de etiquetas con autocompletar y creación al vuelo.
 *
 * `seleccion` es un array de objetos etiqueta; `alCambiar` recibe el nuevo
 * array. Las sugerencias salen de `useEtiquetas()` por coincidencia de
 * subcadena insensible a caja, excluyendo las ya seleccionadas. Si el texto
 * recortado no coincide exactamente con ninguna etiqueta y no está vacío, se
 * ofrece "Crear «texto»", que hace `POST /api/etiquetas` vía el hook.
 */
export function AutocompletarEtiquetas({ seleccion = [], alCambiar, id }) {
  const { etiquetas, crear } = useEtiquetas();

  const [texto, setTexto] = useState('');
  const [resaltado, setResaltado] = useState(0);
  const [error, setError] = useState(null);
  const [creando, setCreando] = useState(false);
  const inputRef = useRef(null);

  const idGenerado = useId();
  const idListbox = `${id ?? idGenerado}-listbox`;

  const seleccionIds = useMemo(
    () => new Set(seleccion.map((e) => String(e.id))),
    [seleccion],
  );

  const consulta = texto.trim().toLowerCase();

  const sugerencias = useMemo(() => {
    if (consulta === '') {
      return [];
    }
    return etiquetas.filter(
      (e) => !seleccionIds.has(String(e.id)) && e.nombre.toLowerCase().includes(consulta),
    );
  }, [etiquetas, seleccionIds, consulta]);

  const hayCoincidenciaExacta = etiquetas.some(
    (e) => e.nombre.trim().toLowerCase() === consulta,
  );
  const puedeCrear = consulta !== '' && !hayCoincidenciaExacta;

  // Opciones navegables: sugerencias + (opcional) la de crear.
  const opciones = puedeCrear
    ? [...sugerencias, { crear: true }]
    : sugerencias;

  function anadir(etiqueta) {
    if (seleccionIds.has(String(etiqueta.id))) {
      return;
    }
    alCambiar?.([...seleccion, etiqueta]);
    setTexto('');
    setResaltado(0);
    setError(null);
  }

  function quitar(etiqueta) {
    alCambiar?.(seleccion.filter((e) => String(e.id) !== String(etiqueta.id)));
    setError(null);
  }

  async function crearAlVuelo() {
    if (creando) {
      return;
    }
    const nombre = texto.trim();
    if (nombre === '') {
      return;
    }
    setCreando(true);
    setError(null);
    try {
      const etiqueta = await crear(nombre);
      anadir(etiqueta);
    } catch (err) {
      setError(err instanceof ErrorApi
        ? err.mensaje
        : 'No se ha podido crear la etiqueta. Inténtalo de nuevo.');
    } finally {
      setCreando(false);
      inputRef.current?.focus();
    }
  }

  function elegir(indice) {
    const opcion = opciones[indice];
    if (!opcion) {
      return;
    }
    if (opcion.crear) {
      crearAlVuelo();
    } else {
      anadir(opcion);
    }
  }

  function alTeclear(evento) {
    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      setResaltado((i) => (opciones.length === 0 ? 0 : (i + 1) % opciones.length));
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      setResaltado((i) => (opciones.length === 0 ? 0 : (i - 1 + opciones.length) % opciones.length));
    } else if (evento.key === 'Enter') {
      if (opciones.length > 0) {
        evento.preventDefault();
        elegir(resaltado);
      }
    } else if (evento.key === 'Backspace' && texto === '' && seleccion.length > 0) {
      evento.preventDefault();
      quitar(seleccion[seleccion.length - 1]);
    }
  }

  const abierto = opciones.length > 0;

  return (
    <div className={estilos.contenedor}>
      {seleccion.length > 0 && (
        <ul className={estilos.chips}>
          {seleccion.map((etiqueta) => (
            <li key={String(etiqueta.id)} className={estilos.chip}>
              <span>{etiqueta.nombre}</span>
              <button
                type="button"
                className={estilos.quitarChip}
                onClick={() => quitar(etiqueta)}
                aria-label={`Quitar etiqueta ${etiqueta.nombre}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        id={id ?? idGenerado}
        type="text"
        className={estilos.entrada}
        role="combobox"
        aria-expanded={abierto}
        aria-controls={idListbox}
        aria-autocomplete="list"
        autoComplete="off"
        value={texto}
        placeholder="Añade etiquetas…"
        onChange={(evento) => {
          setTexto(evento.target.value);
          setResaltado(0);
        }}
        onKeyDown={alTeclear}
      />

      {abierto && (
        <ul className={estilos.sugerencias} role="listbox" id={idListbox}>
          {opciones.map((opcion, indice) => (
            <li
              key={opcion.crear ? '__crear__' : String(opcion.id)}
              role="option"
              aria-selected={indice === resaltado}
              className={indice === resaltado ? estilos.opcionResaltada : estilos.opcion}
              onMouseDown={(evento) => {
                evento.preventDefault();
                elegir(indice);
              }}
            >
              {opcion.crear ? (
                <>Crear «{texto.trim()}»{creando ? ' …' : ''}</>
              ) : (
                opcion.nombre
              )}
            </li>
          ))}
        </ul>
      )}

      <MensajeError>{error}</MensajeError>
    </div>
  );
}
