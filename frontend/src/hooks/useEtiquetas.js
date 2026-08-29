import { useCallback, useEffect, useState } from 'react';
import { crearEtiqueta, listarEtiquetas } from '../servicios/api.js';

/** Orden por nombre insensible a caja, el mismo criterio que aplica el backend. */
function porNombre(a, b) {
  return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
}

/**
 * Hook mínimo de soporte para el autocompletar de etiquetas y el multi-selector
 * del filtro. Única puerta de la interfaz a `/api/etiquetas`: ningún componente
 * hace `fetch` ni llama a la capa de servicios por su cuenta.
 *
 * Carga `GET /api/etiquetas` una vez al montar. `crear` hace `POST /api/etiquetas`
 * y, tras éxito, inserta la etiqueta devuelta en `etiquetas` en orden por nombre
 * sin recargar; su error se propaga con `throw` (incluye el `409` de nombre
 * duplicado) para que el campo lo muestre junto a sí mismo.
 */
export function useEtiquetas() {
  const [etiquetas, setEtiquetas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const recargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const lista = await listarEtiquetas();
      setEtiquetas(Array.isArray(lista) ? [...lista].sort(porNombre) : []);
    } catch (err) {
      setError(err);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  const crear = useCallback(async (nombre) => {
    const etiqueta = await crearEtiqueta(nombre);
    setEtiquetas((actuales) => {
      if (actuales.some((e) => String(e.id) === String(etiqueta.id))) {
        return actuales;
      }
      return [...actuales, etiqueta].sort(porNombre);
    });
    return etiqueta;
  }, []);

  return { etiquetas, cargando, error, recargar, crear };
}
