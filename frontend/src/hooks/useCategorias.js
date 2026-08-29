import { useCallback, useEffect, useState } from 'react';
import {
  crearCategoria,
  editarCategoria,
  eliminarCategoria,
  listarCategorias,
} from '../servicios/api.js';

/**
 * Única puerta de la interfaz a `/api/categorias`. La pantalla de categorías y,
 * más adelante, el selector de categoría del formulario de tarea lo reutilizan
 * tal cual: ningún componente hace `fetch` ni llama a la capa de servicios por
 * su cuenta.
 *
 * `error` es solo el `ErrorApi` de la *carga de la lista*, que la pantalla
 * muestra con opción de reintento. Las acciones `crear`/`editar`/`eliminar`
 * propagan su propio error (`throw`) para que el formulario o el diálogo
 * decidan cómo presentarlo (junto al campo o genérico).
 */
export function useCategorias() {
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const recargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const lista = await listarCategorias();
      setCategorias(Array.isArray(lista) ? lista : []);
    } catch (err) {
      setError(err);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  // Solo tras éxito se reconcilia la lista pidiéndola de nuevo: así el orden por
  // nombre y el criterio de unicidad los sigue fijando el servidor.
  const crear = useCallback(async (nombre) => {
    const categoria = await crearCategoria(nombre);
    await recargar();
    return categoria;
  }, [recargar]);

  const editar = useCallback(async (id, nombre) => {
    const categoria = await editarCategoria(id, nombre);
    await recargar();
    return categoria;
  }, [recargar]);

  const eliminar = useCallback(async (id) => {
    await eliminarCategoria(id);
    await recargar();
  }, [recargar]);

  return { categorias, cargando, error, recargar, crear, editar, eliminar };
}
