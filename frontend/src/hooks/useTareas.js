import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cambiarCompletada as cambiarCompletadaEnApi,
  crearTarea,
  editarTarea,
  eliminarTarea,
  listarTareas,
} from '../servicios/api.js';

/**
 * Versión estable de un objeto de filtros: dos objetos con las mismas claves y
 * valores producen la misma cadena, de modo que el efecto de carga no se
 * dispare por una identidad de objeto nueva. Las claves se ordenan para que el
 * orden de inserción no cuente.
 */
function serializarFiltros(filtros) {
  const entradas = Object.entries(filtros ?? {})
    .filter(([, valor]) => valor !== undefined && valor !== null && valor !== ''
      && !(Array.isArray(valor) && valor.length === 0))
    .map(([clave, valor]) => [clave, Array.isArray(valor) ? [...valor].sort() : valor])
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entradas);
}

/**
 * Única puerta de la pantalla de tareas a `/api/tareas` y a
 * `/api/tareas/:id/completar`. Recibe el conjunto de filtros ya normalizado a
 * los nombres de parámetro del backend y vuelve a consultar cuando su versión
 * serializada cambia.
 *
 * `error` es solo el `ErrorApi` de la *carga de la lista* (incluye el `400` por
 * parámetro inválido), que la pantalla muestra con opción de reintento. Las
 * acciones `crear`/`editar`/`eliminar`/`cambiarCompletada` reconcilian la lista
 * con `recargar` **solo tras éxito** y propagan su propio error con `throw`.
 */
export function useTareas(filtros) {
  const [tareas, setTareas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const clave = serializarFiltros(filtros);
  // El objeto vigente de filtros, sin provocar recreaciones de `recargar`.
  const filtrosRef = useRef(filtros);
  filtrosRef.current = filtros;
  // Contador de secuencia: una respuesta de una consulta anterior que llega
  // tarde trae un número menor que el vigente y se descarta.
  const secuencia = useRef(0);

  const recargar = useCallback(async () => {
    const propia = secuencia.current + 1;
    secuencia.current = propia;
    setCargando(true);
    setError(null);
    try {
      const lista = await listarTareas(filtrosRef.current);
      if (secuencia.current === propia) {
        setTareas(Array.isArray(lista) ? lista : []);
      }
    } catch (err) {
      if (secuencia.current === propia) {
        setError(err);
      }
    } finally {
      if (secuencia.current === propia) {
        setCargando(false);
      }
    }
  }, []);

  useEffect(() => {
    recargar();
    // `clave` es la versión estable de `filtros`; `recargar` lee el objeto
    // vigente desde la ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, recargar]);

  const crear = useCallback(async (datos) => {
    const tarea = await crearTarea(datos);
    await recargar();
    return tarea;
  }, [recargar]);

  const editar = useCallback(async (id, datos) => {
    const tarea = await editarTarea(id, datos);
    await recargar();
    return tarea;
  }, [recargar]);

  const eliminar = useCallback(async (id) => {
    await eliminarTarea(id);
    await recargar();
  }, [recargar]);

  const cambiarCompletada = useCallback(async (id, completada) => {
    const tarea = await cambiarCompletadaEnApi(id, completada);
    await recargar();
    return tarea;
  }, [recargar]);

  return { tareas, cargando, error, recargar, crear, editar, eliminar, cambiarCompletada };
}
