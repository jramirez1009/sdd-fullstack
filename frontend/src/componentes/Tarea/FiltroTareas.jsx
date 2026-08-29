import { useEffect, useId, useRef, useState } from 'react';
import { useCategorias } from '../../hooks/useCategorias.js';
import { useEtiquetas } from '../../hooks/useEtiquetas.js';
import estilos from './FiltroTareas.module.css';

const RETARDO_BUSQUEDA = 350;

const PRIORIDADES = ['baja', 'media', 'alta'];
const ORDENACIONES = [
  { valor: '', texto: 'Por defecto' },
  { valor: 'creado_en', texto: 'Fecha de creación' },
  { valor: 'fecha_vencimiento', texto: 'Fecha de vencimiento' },
  { valor: 'prioridad', texto: 'Prioridad' },
  { valor: 'titulo', texto: 'Título' },
];

/**
 * Panel de filtros. Traduce cada control a un parámetro de `GET /api/tareas`
 * uno a uno y llama a `alCambiar` con las claves afectadas en el acto —sin
 * botón de aplicar—. El texto de búsqueda es la única excepción: se aplica con
 * debounce de 300–400 ms.
 *
 * `valores` es el estado de interfaz de los filtros que posee `ListaTareas`.
 */
export function FiltroTareas({ valores, alCambiar }) {
  const { categorias, cargando: cargandoCategorias } = useCategorias();
  const { etiquetas } = useEtiquetas();

  const idBase = useId();

  // Búsqueda: responde en cada tecla, pero solo entra en los filtros tras la
  // pausa. Se inicializa desde el valor efectivo y no se re-sincroniza salvo
  // que cambie desde fuera (p. ej. un reinicio de filtros).
  const [busqueda, setBusqueda] = useState(valores.busqueda ?? '');
  const primeraVez = useRef(true);

  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false;
      return undefined;
    }
    const id = setTimeout(() => {
      alCambiar({ busqueda: busqueda.trim() });
    }, RETARDO_BUSQUEDA);
    return () => clearTimeout(id);
  }, [busqueda, alCambiar]);

  function alternarEtiqueta(nombre) {
    const actuales = valores.etiquetas ?? [];
    const nuevas = actuales.includes(nombre)
      ? actuales.filter((n) => n !== nombre)
      : [...actuales, nombre];
    alCambiar({ etiquetas: nuevas });
  }

  return (
    <div className={estilos.panel}>
      <div className={estilos.campo}>
        <label className={estilos.etiqueta} htmlFor={`${idBase}-estado`}>Estado</label>
        <select
          id={`${idBase}-estado`}
          className={estilos.control}
          value={valores.completada ?? ''}
          onChange={(e) => alCambiar({ completada: e.target.value })}
        >
          <option value="">Todas</option>
          <option value="true">Completadas</option>
          <option value="false">Pendientes</option>
        </select>
      </div>

      <div className={estilos.campo}>
        <label className={estilos.etiqueta} htmlFor={`${idBase}-categoria`}>Categoría</label>
        <select
          id={`${idBase}-categoria`}
          className={estilos.control}
          value={valores.categoria ?? ''}
          onChange={(e) => alCambiar({ categoria: e.target.value })}
          disabled={cargandoCategorias}
        >
          <option value="">Todas</option>
          <option value="ninguna">Sin categoría</option>
          {categorias.map((categoria) => (
            <option key={String(categoria.id)} value={String(categoria.id)}>
              {categoria.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className={estilos.campo}>
        <label className={estilos.etiqueta} htmlFor={`${idBase}-prioridad`}>Prioridad</label>
        <select
          id={`${idBase}-prioridad`}
          className={estilos.control}
          value={valores.prioridad ?? ''}
          onChange={(e) => alCambiar({ prioridad: e.target.value })}
        >
          <option value="">Todas</option>
          {PRIORIDADES.map((p) => (
            <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>
          ))}
        </select>
      </div>

      <div className={estilos.campo}>
        <label className={estilos.etiqueta} htmlFor={`${idBase}-desde`}>Vence desde</label>
        <input
          id={`${idBase}-desde`}
          type="date"
          className={estilos.control}
          value={valores.fecha_vencimiento_desde ?? ''}
          onChange={(e) => alCambiar({ fecha_vencimiento_desde: e.target.value })}
        />
      </div>

      <div className={estilos.campo}>
        <label className={estilos.etiqueta} htmlFor={`${idBase}-hasta`}>Vence hasta</label>
        <input
          id={`${idBase}-hasta`}
          type="date"
          className={estilos.control}
          value={valores.fecha_vencimiento_hasta ?? ''}
          onChange={(e) => alCambiar({ fecha_vencimiento_hasta: e.target.value })}
        />
      </div>

      <div className={estilos.campo}>
        <label className={estilos.etiqueta} htmlFor={`${idBase}-busqueda`}>Buscar</label>
        <input
          id={`${idBase}-busqueda`}
          type="search"
          className={estilos.control}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Título o descripción…"
        />
      </div>

      <div className={estilos.campo}>
        <label className={estilos.etiqueta} htmlFor={`${idBase}-ordenar`}>Ordenar por</label>
        <select
          id={`${idBase}-ordenar`}
          className={estilos.control}
          value={valores.ordenar ?? ''}
          onChange={(e) => alCambiar({ ordenar: e.target.value })}
        >
          {ORDENACIONES.map((o) => (
            <option key={o.valor} value={o.valor}>{o.texto}</option>
          ))}
        </select>
      </div>

      <div className={estilos.campo}>
        <label className={estilos.etiqueta} htmlFor={`${idBase}-direccion`}>Dirección</label>
        <select
          id={`${idBase}-direccion`}
          className={estilos.control}
          value={valores.direccion ?? ''}
          onChange={(e) => alCambiar({ direccion: e.target.value })}
          disabled={!valores.ordenar}
        >
          <option value="">Por defecto</option>
          <option value="asc">Ascendente</option>
          <option value="desc">Descendente</option>
        </select>
      </div>

      {etiquetas.length > 0 && (
        <fieldset className={estilos.etiquetasCampo}>
          <legend className={estilos.etiqueta}>Etiquetas</legend>
          <div className={estilos.listaEtiquetas}>
            {etiquetas.map((etiqueta) => (
              <label key={String(etiqueta.id)} className={estilos.opcionEtiqueta}>
                <input
                  type="checkbox"
                  checked={(valores.etiquetas ?? []).includes(etiqueta.nombre)}
                  onChange={() => alternarEtiqueta(etiqueta.nombre)}
                />
                {etiqueta.nombre}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}
