import {
  createContext,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

// Clave del almacenamiento persistente. Está aquí y en ningún otro sitio salvo
// el script inline de index.html, que aplica el mismo valor antes del primer
// pintado para evitar el destello del tema contrario.
const CLAVE_TEMA = 'lista-tareas.tema';

const CONSULTA_OSCURO = '(prefers-color-scheme: dark)';

export const ContextoTema = createContext(null);

/** Solo 'claro' u 'oscuro' cuentan como elección; cualquier otro valor —o la
 *  ausencia de almacenamiento— se trata como "seguir al sistema". */
function normalizarTema(valor) {
  return valor === 'claro' || valor === 'oscuro' ? valor : null;
}

/** Lectura defensiva: en modo privado de algunos navegadores el acceso lanza. */
function leerTemaGuardado() {
  try {
    return normalizarTema(window.localStorage.getItem(CLAVE_TEMA));
  } catch {
    return null;
  }
}

function guardarTema(tema) {
  try {
    window.localStorage.setItem(CLAVE_TEMA, tema);
  } catch {
    // Sin almacenamiento la elección sigue viva en memoria durante la sesión;
    // solo no sobrevive a una recarga. Es preferible a impedir el cambio.
  }
}

/** Preferencia del sistema operativo. Degrada a 'claro' si `matchMedia` no
 *  existe: es el tema por defecto del proyecto. */
function leerTemaSistema() {
  try {
    return window.matchMedia(CONSULTA_OSCURO).matches ? 'oscuro' : 'claro';
  } catch {
    return 'claro';
  }
}

export function ProveedorTema({ children }) {
  // Se lee una sola vez, en el estado inicial: releerlo en cada render haría
  // que el valor guardado, y no el estado de React, mandara sobre el tema.
  const [temaElegido, setTemaElegido] = useState(() => leerTemaGuardado());
  const [temaSistema, setTemaSistema] = useState(() => leerTemaSistema());

  // Mientras no haya elección manual, el tema sigue a la preferencia del
  // sistema y reacciona a sus cambios en caliente. Con elección guardada, esta
  // suscripción se mantiene pero `temaActivo` la ignora.
  useEffect(() => {
    let media;
    try {
      media = window.matchMedia(CONSULTA_OSCURO);
    } catch {
      return undefined;
    }
    const alCambiar = (evento) => {
      setTemaSistema(evento.matches ? 'oscuro' : 'claro');
    };
    media.addEventListener('change', alCambiar);
    return () => media.removeEventListener('change', alCambiar);
  }, []);

  const temaActivo = temaElegido ?? temaSistema;

  // Efecto de layout, no normal: el atributo debe estar puesto antes de que el
  // navegador pinte, para que ningún fotograma muestre el tema anterior.
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', temaActivo);
  }, [temaActivo]);

  const alternarTema = useCallback(() => {
    setTemaElegido((elegido) => {
      const base = elegido ?? leerTemaSistema();
      const siguiente = base === 'oscuro' ? 'claro' : 'oscuro';
      guardarTema(siguiente);
      return siguiente;
    });
  }, []);

  const valor = useMemo(
    () => ({ tema: temaActivo, alternarTema }),
    [temaActivo, alternarTema],
  );

  return <ContextoTema.Provider value={valor}>{children}</ContextoTema.Provider>;
}
