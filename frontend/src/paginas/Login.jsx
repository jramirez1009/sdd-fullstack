import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Cargando } from '../componentes/Comunes/Cargando.jsx';
import { MensajeError } from '../componentes/Comunes/MensajeError.jsx';
import { MOTIVO_CIERRE } from '../contextos/ContextoAuth.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { ErrorApi } from '../servicios/api.js';
import { validarLogin } from '../servicios/validacion.js';
import estilos from './Login.module.css';

/**
 * Mensajes por código de error estable, nunca por el texto de la respuesta: así
 * reescribir un mensaje en el backend no cambia el comportamiento de la
 * pantalla. `CREDENCIALES_INVALIDAS` tiene un texto único que no distingue el
 * email de la contraseña, porque desglosarlo revelaría qué emails están
 * registrados y perdería lo que la API protege.
 */
const MENSAJES = {
  CREDENCIALES_INVALIDAS: 'Email o contraseña incorrectos.',
  DEMASIADAS_PETICIONES: 'Demasiados intentos seguidos. Espera un momento antes de volver a intentarlo.',
  ERROR_RED: 'No se ha podido conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.',
};

function mensajeDe(error) {
  if (!(error instanceof ErrorApi)) {
    return 'Se produjo un error inesperado. Inténtalo de nuevo más tarde.';
  }
  return MENSAJES[error.codigo] ?? error.mensaje;
}

export function Login() {
  const { iniciarSesion, motivoCierre, limpiarMotivoCierre } = useAuth();
  const navegar = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [erroresCampo, setErroresCampo] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);
  // El estado de React no se actualiza dentro del mismo turno del bucle de
  // eventos, así que dos activaciones seguidas del control leerían el mismo
  // `enviando` en false. La referencia sí cambia al instante: es lo que hace que
  // "solo se realiza una petición" se cumpla incluso ante clics sin pausa.
  const enVuelo = useRef(false);

  // El aviso solo se muestra cuando se ha llegado aquí por caducidad del token,
  // no tras unas credenciales incorrectas ni en una visita normal.
  const sesionCaducada = motivoCierre === MOTIVO_CIERRE.CADUCADA;
  // El arranque no pudo comprobar el token guardado por falta de conexión. Se
  // dice explícitamente para no dejar el fallo en silencio ni confundirlo con
  // unas credenciales incorrectas.
  const sinConexionAlArrancar = motivoCierre === MOTIVO_CIERRE.SIN_CONEXION;

  async function alEnviar(evento) {
    // El formulario se envía con el botón y también con la tecla Intro; en
    // ambos casos pasa por aquí y no recarga la página.
    evento.preventDefault();

    // Un segundo envío no puede lanzarse mientras el primero está en vuelo.
    if (enVuelo.current) {
      return;
    }

    setErrorGeneral(null);
    limpiarMotivoCierre();

    const detalles = validarLogin({ email, password });
    setErroresCampo(detalles);
    if (Object.keys(detalles).length > 0) {
      // No se llama a la API: no hay nada que preguntar todavía.
      return;
    }

    enVuelo.current = true;
    setEnviando(true);
    try {
      await iniciarSesion(email.trim(), password);
      navegar('/tareas', { replace: true });
    } catch (error) {
      // Los errores por campo de la API llegan con la misma forma que los del
      // cliente, así que se pintan por el mismo camino.
      if (error instanceof ErrorApi && error.detalles) {
        setErroresCampo(error.detalles);
      }
      setErrorGeneral(mensajeDe(error));
    } finally {
      enVuelo.current = false;
      // El control vuelve a estar habilitado también tras un fallo, para poder
      // reintentar sin recargar la página.
      setEnviando(false);
    }
  }

  return (
    <main className={estilos.pantalla}>
      <div className={estilos.tarjeta}>
        <h1 className={estilos.titulo}>Iniciar sesión</h1>
        <p className={estilos.introduccion}>Accede para gestionar tus tareas.</p>

        <div className={estilos.zonaEstado}>
          {sesionCaducada && (
            <MensajeError tono="aviso">
              Tu sesión ha caducado. Vuelve a iniciar sesión para continuar.
            </MensajeError>
          )}
          {sinConexionAlArrancar && (
            <MensajeError tono="aviso">
              No hemos podido comprobar tu sesión porque no hay conexión con el servidor.
              Vuelve a iniciar sesión cuando se restablezca.
            </MensajeError>
          )}
          <MensajeError>{errorGeneral}</MensajeError>
        </div>

        <form className={estilos.formulario} onSubmit={alEnviar} noValidate>
          <div className={estilos.campo}>
            <label className={estilos.etiqueta} htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              className={erroresCampo.email ? estilos.entradaInvalida : estilos.entrada}
              value={email}
              onChange={(evento) => setEmail(evento.target.value)}
              autoComplete="email"
              aria-invalid={erroresCampo.email ? 'true' : undefined}
              aria-describedby={erroresCampo.email ? 'error-email' : undefined}
            />
            {erroresCampo.email && (
              <span className={estilos.errorCampo} id="error-email">{erroresCampo.email}</span>
            )}
          </div>

          <div className={estilos.campo}>
            <label className={estilos.etiqueta} htmlFor="password">Contraseña</label>
            <input
              id="password"
              name="password"
              type="password"
              className={erroresCampo.password ? estilos.entradaInvalida : estilos.entrada}
              value={password}
              onChange={(evento) => setPassword(evento.target.value)}
              autoComplete="current-password"
              aria-invalid={erroresCampo.password ? 'true' : undefined}
              aria-describedby={erroresCampo.password ? 'error-password' : undefined}
            />
            {erroresCampo.password && (
              <span className={estilos.errorCampo} id="error-password">{erroresCampo.password}</span>
            )}
          </div>

          <button className={estilos.boton} type="submit" disabled={enviando}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>

          {enviando && <Cargando texto="Comprobando tus credenciales…" />}
        </form>

        <p className={estilos.pie}>
          ¿Todavía no tienes cuenta? <Link to="/registro">Crear una cuenta</Link>
        </p>
      </div>
    </main>
  );
}
