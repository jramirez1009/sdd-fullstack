import {
  createContext,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ErrorApi,
  establecerToken,
  login as loginApi,
  perfil as perfilApi,
  registrar as registrarApi,
  registrarManejadorSesionCaducada,
} from '../servicios/api.js';

// Clave del almacenamiento persistente. Está aquí y en ningún otro sitio:
// ningún componente lee el token del navegador por su cuenta.
const CLAVE_TOKEN = 'lista-tareas.token';

/** Motivos por los que la sesión terminó, para que la pantalla de inicio de
 *  sesión sepa si debe avisar de una caducidad. */
export const MOTIVO_CIERRE = {
  EXPLICITO: 'explicito',
  CADUCADA: 'caducada',
  SIN_CONEXION: 'sin_conexion',
};

export const ContextoAuth = createContext(null);

/** Lectura defensiva: en modo privado de algunos navegadores el acceso lanza. */
function leerTokenGuardado() {
  try {
    return window.localStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null;
  }
}

function guardarToken(token) {
  try {
    window.localStorage.setItem(CLAVE_TOKEN, token);
  } catch {
    // Sin almacenamiento la sesión sigue viva en memoria; solo no sobrevive a
    // una recarga. Es preferible a impedir el inicio de sesión.
  }
}

function borrarToken() {
  try {
    window.localStorage.removeItem(CLAVE_TOKEN);
  } catch {
    // Ídem: nada que hacer, y el estado en memoria ya se ha vaciado.
  }
}

export function ProveedorAuth({ children }) {
  // Se lee una sola vez, en el estado inicial: releerlo en cada render haría
  // que el token guardado, y no el estado de React, mandara sobre la sesión.
  const [token, setToken] = useState(() => leerTokenGuardado());
  const [usuario, setUsuario] = useState(null);
  // Solo hay algo que restaurar si había token guardado. Sin él, la aplicación
  // sabe desde el primer render que no hay sesión y no pinta estado de carga.
  const [cargandoSesion, setCargandoSesion] = useState(() => leerTokenGuardado() !== null);
  const [motivoCierre, setMotivoCierre] = useState(null);

  // Sincroniza la copia del token que guarda el servicio de API. Es el único
  // punto de escritura reactivo. Va en un efecto de layout y no en uno normal
  // porque los efectos de layout del padre se ejecutan antes que los efectos
  // normales de los hijos: así ninguna pantalla puede lanzar su primera
  // petición con un token desactualizado.
  useLayoutEffect(() => {
    establecerToken(token);
  }, [token]);

  const cerrarSesion = useCallback((motivo = MOTIVO_CIERRE.EXPLICITO) => {
    borrarToken();
    establecerToken(null);
    setToken(null);
    setUsuario(null);
    setCargandoSesion(false);
    setMotivoCierre(motivo);
  }, []);

  // Se guarda en una referencia para que el manejador registrado en el servicio
  // de API no dependa de la identidad de `cerrarSesion` ni se reinstale.
  const cerrarSesionRef = useRef(cerrarSesion);
  cerrarSesionRef.current = cerrarSesion;

  // El servicio de API avisa aquí cuando una llamada protegida recibe un 401.
  // La redirección no se dispara desde aquí: al vaciarse la sesión, el guardián
  // de rutas deja de dejar pasar y redirige por sí solo.
  useEffect(() => registrarManejadorSesionCaducada(() => {
    cerrarSesionRef.current(MOTIVO_CIERRE.CADUCADA);
  }), []);

  // Restauración al arrancar: un token guardado no se da por bueno hasta que la
  // API lo confirma. Ver design.md § 3.
  useEffect(() => {
    const tokenGuardado = leerTokenGuardado();
    if (!tokenGuardado) {
      return undefined;
    }

    let cancelado = false;

    (async () => {
      try {
        const datos = await perfilApi();
        if (!cancelado) {
          setUsuario(datos);
        }
      } catch (error) {
        if (cancelado) {
          return;
        }
        if (error instanceof ErrorApi && error.estadoHttp === 401) {
          // El token guardado ya no vale: se descarta. No es una caducidad
          // ocurrida durante el uso, así que no se avisa de ella.
          borrarToken();
          establecerToken(null);
          setToken(null);
        } else {
          // Fallo de red o error del servidor: sin poder confirmar el token, se
          // trata como no autenticado. Dar la sesión por buena llevaría a una
          // pantalla que fallaría en su primera petición real. El token guardado
          // se conserva para que un arranque posterior pueda revalidarlo.
          setToken(null);
          establecerToken(null);
          // El motivo se registra para que la pantalla de inicio de sesión
          // explique por qué se ha llegado ahí: un fallo no puede quedar en
          // silencio, y este se distingue de unas credenciales incorrectas.
          setMotivoCierre(MOTIVO_CIERRE.SIN_CONEXION);
        }
        setUsuario(null);
      } finally {
        if (!cancelado) {
          setCargandoSesion(false);
        }
      }
    })();

    return () => {
      cancelado = true;
    };
  }, []);

  const iniciarSesion = useCallback(async (email, password) => {
    const { token: tokenNuevo, usuario: usuarioNuevo } = await loginApi(email, password);
    guardarToken(tokenNuevo);
    // Se fija también en el servicio antes de devolver: si el llamador lanza
    // una petición inmediatamente, no debe esperar al efecto de sincronización.
    establecerToken(tokenNuevo);
    setToken(tokenNuevo);
    setUsuario(usuarioNuevo);
    setCargandoSesion(false);
    setMotivoCierre(null);
  }, []);

  /**
   * Registro y sesión encadenados: el endpoint de registro devuelve el usuario
   * pero no un token, así que se inicia sesión con las mismas credenciales para
   * no pedirlas dos veces. Ver design.md § 6.
   *
   * Si el registro va bien pero el inicio de sesión falla, la cuenta existe: se
   * marca el error para que la pantalla invite a iniciar sesión en lugar de
   * mostrar un fallo de registro que llevaría a chocar con un 409.
   */
  const registrar = useCallback(async (email, password) => {
    await registrarApi(email, password);
    try {
      await iniciarSesion(email, password);
    } catch (error) {
      if (error instanceof ErrorApi) {
        error.cuentaCreada = true;
      }
      throw error;
    }
  }, [iniciarSesion]);

  /** Retira el aviso de sesión caducada una vez mostrado. */
  const limpiarMotivoCierre = useCallback(() => {
    setMotivoCierre(null);
  }, []);

  const valor = useMemo(
    () => ({
      usuario,
      token,
      cargandoSesion,
      motivoCierre,
      iniciarSesion,
      registrar,
      cerrarSesion,
      limpiarMotivoCierre,
    }),
    [usuario, token, cargandoSesion, motivoCierre, iniciarSesion, registrar, cerrarSesion, limpiarMotivoCierre],
  );

  return <ContextoAuth.Provider value={valor}>{children}</ContextoAuth.Provider>;
}
