import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Cargando } from '../componentes/Comunes/Cargando.jsx';
import { MensajeError } from '../componentes/Comunes/MensajeError.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { ErrorApi } from '../servicios/api.js';
import {
  LONGITUD_MAXIMA_PASSWORD,
  LONGITUD_MINIMA_PASSWORD,
  validarRegistro,
} from '../servicios/validacion.js';
import estilos from './Registro.module.css';

/** Igual que en la pantalla de inicio de sesión: se decide por el código. */
const MENSAJES = {
  EMAIL_DUPLICADO: 'Ya existe una cuenta con ese email. Prueba a iniciar sesión o usa otra dirección.',
  DEMASIADAS_PETICIONES: 'Demasiados intentos seguidos. Espera un momento antes de volver a intentarlo.',
  ERROR_RED: 'No se ha podido conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.',
};

function mensajeDe(error) {
  if (!(error instanceof ErrorApi)) {
    return 'Se produjo un error inesperado. Inténtalo de nuevo más tarde.';
  }
  // El registro fue bien pero el inicio de sesión encadenado falló: la cuenta
  // existe. Decirlo así evita que se reintente el registro y se choque con un
  // 409 que sonaría a que algo se hizo mal.
  if (error.cuentaCreada) {
    return 'Tu cuenta se ha creado, pero no hemos podido iniciar sesión automáticamente. Entra con tus credenciales.';
  }
  return MENSAJES[error.codigo] ?? error.mensaje;
}

export function Registro() {
  const { registrar } = useAuth();
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

  async function alEnviar(evento) {
    evento.preventDefault();

    if (enVuelo.current) {
      return;
    }

    setErrorGeneral(null);

    // Validación del cliente antes de llamar a la API: un email mal formado no
    // llega a producir ninguna petición.
    const detalles = validarRegistro({ email, password });
    setErroresCampo(detalles);
    if (Object.keys(detalles).length > 0) {
      return;
    }

    enVuelo.current = true;
    setEnviando(true);
    try {
      await registrar(email.trim(), password);
      navegar('/tareas', { replace: true });
    } catch (error) {
      if (error instanceof ErrorApi && error.detalles) {
        setErroresCampo(error.detalles);
      }
      setErrorGeneral(mensajeDe(error));
      // Lo escrito se conserva deliberadamente: obligar a rellenar el
      // formulario entero para corregir un campo sería un castigo por un error.
    } finally {
      enVuelo.current = false;
      setEnviando(false);
    }
  }

  return (
    <main className={estilos.pantalla}>
      <div className={estilos.tarjeta}>
        <h1 className={estilos.titulo}>Crear cuenta</h1>
        <p className={estilos.introduccion}>Regístrate para empezar a organizar tus tareas.</p>

        <div className={estilos.zonaEstado}>
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
              autoComplete="new-password"
              aria-invalid={erroresCampo.password ? 'true' : undefined}
              aria-describedby={
                erroresCampo.password ? 'error-password ayuda-password' : 'ayuda-password'
              }
            />
            <span className={estilos.ayuda} id="ayuda-password">
              {`Entre ${LONGITUD_MINIMA_PASSWORD} y ${LONGITUD_MAXIMA_PASSWORD} bytes; las letras acentuadas ocupan dos.`}
            </span>
            {erroresCampo.password && (
              <span className={estilos.errorCampo} id="error-password">{erroresCampo.password}</span>
            )}
          </div>

          <button className={estilos.boton} type="submit" disabled={enviando}>
            {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>

          {enviando && <Cargando texto="Creando tu cuenta…" />}
        </form>

        <p className={estilos.pie}>
          ¿Ya tienes cuenta? <Link to="/login">Iniciar sesión</Link>
        </p>
      </div>
    </main>
  );
}
