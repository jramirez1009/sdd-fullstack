import { useId, useRef, useState } from 'react';
import { Cargando } from '../Comunes/Cargando.jsx';
import { MensajeError } from '../Comunes/MensajeError.jsx';
import { ErrorApi } from '../../servicios/api.js';
import { useCategorias } from '../../hooks/useCategorias.js';
import { AutocompletarEtiquetas } from './AutocompletarEtiquetas.jsx';
import estilos from './FormularioTarea.module.css';

const PRIORIDADES = ['baja', 'media', 'alta'];
// Topes del backend; solo ayuda de UX en los inputs, no validación autoritativa.
const LONGITUD_MAXIMA_TITULO = 200;
const LONGITUD_MAXIMA_DESCRIPCION = 2000;

/**
 * Único formulario para crear y editar una tarea. Opera en modo crear si no
 * recibe `tarea` y en modo editar si la recibe, precargando todos sus valores.
 * No ofrece cambiar `completada`: ese estado solo se toca desde el control de
 * cada fila.
 *
 * La única validación de cliente es "título no vacío". El resto de reglas son
 * del backend: un `400 DATOS_INVALIDOS` se reparte por campo (`titulo`,
 * `prioridad`, `fecha_vencimiento`); la referencia inválida (categoría o
 * etiqueta ajena) y cualquier otro fallo se muestran con `<MensajeError>`
 * general.
 */
export function FormularioTarea({ tarea = null, alCrear, alEditar, alGuardar, alCancelar }) {
  const modo = tarea ? 'editar' : 'crear';
  const { categorias, cargando: cargandoCategorias } = useCategorias();

  const [titulo, setTitulo] = useState(tarea?.titulo ?? '');
  const [descripcion, setDescripcion] = useState(tarea?.descripcion ?? '');
  const [prioridad, setPrioridad] = useState(tarea?.prioridad ?? 'media');
  const [fecha, setFecha] = useState(tarea?.fecha_vencimiento ?? '');
  const [categoriaId, setCategoriaId] = useState(
    tarea?.categoria ? String(tarea.categoria.id) : '',
  );
  const [etiquetasSeleccionadas, setEtiquetasSeleccionadas] = useState(
    Array.isArray(tarea?.etiquetas) ? tarea.etiquetas : [],
  );

  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const enVuelo = useRef(false);

  const idBase = useId();
  const idTitulo = `${idBase}-titulo`;
  const idDescripcion = `${idBase}-descripcion`;
  const idPrioridad = `${idBase}-prioridad`;
  const idFecha = `${idBase}-fecha`;
  const idCategoria = `${idBase}-categoria`;
  const idEtiquetas = `${idBase}-etiquetas`;

  async function alEnviar(evento) {
    evento.preventDefault();
    if (enVuelo.current) {
      return;
    }

    setErrores({});
    setErrorGeneral(null);

    if (titulo.trim() === '') {
      setErrores({ titulo: 'Escribe un título para la tarea.' });
      return;
    }

    const datos = {
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      prioridad,
      fecha_vencimiento: fecha || null,
      categoria_id: categoriaId || null,
      etiquetas: etiquetasSeleccionadas.map((e) => String(e.id)),
    };

    enVuelo.current = true;
    setEnviando(true);
    try {
      if (modo === 'editar') {
        await alEditar(tarea.id, datos);
      } else {
        await alCrear(datos);
      }
      alGuardar?.();
    } catch (err) {
      if (err instanceof ErrorApi && err.codigo === 'DATOS_INVALIDOS' && err.detalles) {
        const porCampo = {};
        for (const campo of ['titulo', 'prioridad', 'fecha_vencimiento', 'descripcion']) {
          if (err.detalles[campo]) {
            porCampo[campo] = err.detalles[campo];
          }
        }
        if (Object.keys(porCampo).length > 0) {
          setErrores(porCampo);
        } else {
          setErrorGeneral(err.mensaje);
        }
      } else if (err instanceof ErrorApi) {
        setErrorGeneral(err.mensaje);
      } else {
        setErrorGeneral('Se produjo un error inesperado. Inténtalo de nuevo más tarde.');
      }
    } finally {
      enVuelo.current = false;
      setEnviando(false);
    }
  }

  return (
    <form className={estilos.formulario} onSubmit={alEnviar} noValidate>
      <h2 className={estilos.titulo}>
        {modo === 'editar' ? 'Editar tarea' : 'Nueva tarea'}
      </h2>

      <MensajeError>{errorGeneral}</MensajeError>

      <div className={estilos.campo}>
        <label className={estilos.etiqueta} htmlFor={idTitulo}>Título</label>
        <input
          id={idTitulo}
          type="text"
          className={errores.titulo ? estilos.entradaInvalida : estilos.entrada}
          value={titulo}
          onChange={(evento) => setTitulo(evento.target.value)}
          maxLength={LONGITUD_MAXIMA_TITULO}
          autoFocus
          aria-invalid={errores.titulo ? 'true' : undefined}
          aria-describedby={errores.titulo ? `${idTitulo}-error` : undefined}
        />
        {errores.titulo && (
          <span className={estilos.errorCampo} id={`${idTitulo}-error`}>{errores.titulo}</span>
        )}
      </div>

      <div className={estilos.campo}>
        <label className={estilos.etiqueta} htmlFor={idDescripcion}>Descripción</label>
        <textarea
          id={idDescripcion}
          className={estilos.entrada}
          rows={3}
          value={descripcion}
          onChange={(evento) => setDescripcion(evento.target.value)}
          maxLength={LONGITUD_MAXIMA_DESCRIPCION}
        />
        {errores.descripcion && (
          <span className={estilos.errorCampo}>{errores.descripcion}</span>
        )}
      </div>

      <div className={estilos.campo}>
        <label className={estilos.etiqueta} htmlFor={idPrioridad}>Prioridad</label>
        <select
          id={idPrioridad}
          className={estilos.entrada}
          value={prioridad}
          onChange={(evento) => setPrioridad(evento.target.value)}
          aria-invalid={errores.prioridad ? 'true' : undefined}
        >
          {PRIORIDADES.map((p) => (
            <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>
          ))}
        </select>
        {errores.prioridad && (
          <span className={estilos.errorCampo}>{errores.prioridad}</span>
        )}
      </div>

      <div className={estilos.campo}>
        <label className={estilos.etiqueta} htmlFor={idFecha}>Fecha de vencimiento</label>
        <input
          id={idFecha}
          type="date"
          className={errores.fecha_vencimiento ? estilos.entradaInvalida : estilos.entrada}
          value={fecha}
          onChange={(evento) => setFecha(evento.target.value)}
          aria-invalid={errores.fecha_vencimiento ? 'true' : undefined}
        />
        {errores.fecha_vencimiento && (
          <span className={estilos.errorCampo}>{errores.fecha_vencimiento}</span>
        )}
      </div>

      <div className={estilos.campo}>
        <label className={estilos.etiqueta} htmlFor={idCategoria}>Categoría</label>
        <select
          id={idCategoria}
          className={estilos.entrada}
          value={categoriaId}
          onChange={(evento) => setCategoriaId(evento.target.value)}
          disabled={cargandoCategorias}
        >
          <option value="">Sin categoría</option>
          {categorias.map((categoria) => (
            <option key={String(categoria.id)} value={String(categoria.id)}>
              {categoria.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className={estilos.campo}>
        <label className={estilos.etiqueta} htmlFor={idEtiquetas}>Etiquetas</label>
        <AutocompletarEtiquetas
          id={idEtiquetas}
          seleccion={etiquetasSeleccionadas}
          alCambiar={setEtiquetasSeleccionadas}
        />
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
