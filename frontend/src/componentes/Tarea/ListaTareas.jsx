import { useCallback, useMemo, useState } from 'react';
import { Cargando } from '../Comunes/Cargando.jsx';
import { MensajeError } from '../Comunes/MensajeError.jsx';
import { DialogoConfirmarBorrado } from '../Comunes/DialogoConfirmarBorrado.jsx';
import { ErrorApi } from '../../servicios/api.js';
import { useTareas } from '../../hooks/useTareas.js';
import { FiltroTareas } from './FiltroTareas.jsx';
import { ItemTarea } from './ItemTarea.jsx';
import { FormularioTarea } from './FormularioTarea.jsx';
import estilos from './ListaTareas.module.css';

const FILTROS_INICIALES = {
  completada: '',
  categoria: '',
  prioridad: '',
  fecha_vencimiento_desde: '',
  fecha_vencimiento_hasta: '',
  etiquetas: [],
  busqueda: '',
  ordenar: '',
  direccion: '',
};

/**
 * Traduce el estado de interfaz de los filtros al objeto normalizado con los
 * nombres de parámetro del backend, omitiendo los valores neutros.
 */
function normalizar(ui) {
  const filtros = {};
  if (ui.completada === 'true' || ui.completada === 'false') {
    filtros.completada = ui.completada === 'true';
  }
  if (ui.categoria) {
    filtros.categoria = ui.categoria;
  }
  if (ui.prioridad) {
    filtros.prioridad = ui.prioridad;
  }
  if (ui.fecha_vencimiento_desde) {
    filtros.fecha_vencimiento_desde = ui.fecha_vencimiento_desde;
  }
  if (ui.fecha_vencimiento_hasta) {
    filtros.fecha_vencimiento_hasta = ui.fecha_vencimiento_hasta;
  }
  if (Array.isArray(ui.etiquetas) && ui.etiquetas.length > 0) {
    filtros.etiquetas = ui.etiquetas;
  }
  if (ui.busqueda && ui.busqueda.trim() !== '') {
    filtros.busqueda = ui.busqueda.trim();
  }
  if (ui.ordenar) {
    filtros.ordenar = ui.ordenar;
    if (ui.direccion) {
      filtros.direccion = ui.direccion;
    }
  }
  return filtros;
}

/**
 * Pantalla de gestión de tareas y elemento de la ruta `/tareas`. Posee el
 * estado de interfaz de los filtros, deriva de él el objeto normalizado que
 * pasa a `useTareas`, y decide el cuerpo según el sub-estado. Orquesta además
 * el formulario de alta/edición y el diálogo de confirmación de borrado; tras
 * cada acción exitosa la lista ya viene reconciliada por el hook.
 */
export function ListaTareas() {
  const [filtrosUI, setFiltrosUI] = useState(FILTROS_INICIALES);
  const filtros = useMemo(() => normalizar(filtrosUI), [filtrosUI]);

  const {
    tareas, cargando, error, recargar, crear, editar, eliminar, cambiarCompletada,
  } = useTareas(filtros);

  // null | { modo: 'crear' } | { modo: 'editar', tarea }
  const [formulario, setFormulario] = useState(null);
  // null | tarea
  const [aEliminar, setAEliminar] = useState(null);

  const alCambiarFiltros = useCallback((parciales) => {
    setFiltrosUI((actuales) => ({ ...actuales, ...parciales }));
  }, []);

  const hayFiltrosActivos = Object.keys(filtros).length > 0;

  const mensajeErrorCarga = error instanceof ErrorApi
    ? error.mensaje
    : 'No se han podido cargar las tareas.';

  return (
    <section className={estilos.pantalla}>
      <header className={estilos.cabecera}>
        <h1 className={estilos.titulo}>Tareas</h1>
        <button
          className={estilos.botonPrimario}
          type="button"
          onClick={() => setFormulario({ modo: 'crear' })}
        >
          Nueva tarea
        </button>
      </header>

      <FiltroTareas valores={filtrosUI} alCambiar={alCambiarFiltros} />

      {cargando && <Cargando texto="Cargando tareas…" />}

      {!cargando && error && (
        <div className={estilos.zonaEstado}>
          <MensajeError>{mensajeErrorCarga}</MensajeError>
          <button className={estilos.botonSecundario} type="button" onClick={recargar}>
            Reintentar
          </button>
        </div>
      )}

      {!cargando && !error && tareas.length === 0 && !hayFiltrosActivos && (
        <div className={estilos.vacio}>
          <p>Aún no tienes tareas.</p>
          <button
            className={estilos.botonPrimario}
            type="button"
            onClick={() => setFormulario({ modo: 'crear' })}
          >
            Crear la primera
          </button>
        </div>
      )}

      {!cargando && !error && tareas.length === 0 && hayFiltrosActivos && (
        <p className={estilos.vacio}>No hay tareas que cumplan los filtros.</p>
      )}

      {!cargando && !error && tareas.length > 0 && (
        <ul className={estilos.lista}>
          {tareas.map((tarea) => (
            <ItemTarea
              key={String(tarea.id)}
              tarea={tarea}
              alEditar={(t) => setFormulario({ modo: 'editar', tarea: t })}
              alEliminar={(t) => setAEliminar(t)}
              alCambiarCompletada={cambiarCompletada}
            />
          ))}
        </ul>
      )}

      {formulario && (
        <div className={estilos.zonaFormulario}>
          <FormularioTarea
            tarea={formulario.modo === 'editar' ? formulario.tarea : null}
            alCrear={crear}
            alEditar={editar}
            alGuardar={() => setFormulario(null)}
            alCancelar={() => setFormulario(null)}
          />
        </div>
      )}

      {aEliminar && (
        <DialogoConfirmarBorrado
          titulo="Eliminar tarea"
          descripcion={(
            <>
              Se eliminará la tarea <strong>{aEliminar.titulo}</strong>. Esta
              acción no se puede deshacer.
            </>
          )}
          etiquetaConfirmar="Eliminar"
          etiquetaEnCurso="Eliminando…"
          alConfirmar={async () => {
            await eliminar(String(aEliminar.id));
            setAEliminar(null);
          }}
          alCancelar={() => setAEliminar(null)}
        />
      )}
    </section>
  );
}
