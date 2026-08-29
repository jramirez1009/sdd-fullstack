import { Router } from 'express';
import { registro, login, perfil } from '../controladores/authControlador.js';
import { requiereAutenticacion } from '../middleware/autenticacion.js';
import { crearLimitePeticiones } from '../middleware/limitePeticiones.js';
import { env } from '../config/env.js';

export const authRutas = Router();

// Límite propio y más estricto, independiente del general: cuenta solo los
// intentos de inicio de sesión, para encarecer un ataque de fuerza bruta contra
// contraseñas sin estrechar el uso normal del resto de la API. Se monta
// únicamente sobre /login: el registro de cuentas solo tiene el límite general.
const limiteLogin = crearLimitePeticiones({
  ventanaMs: env.RATE_LIMIT_LOGIN_VENTANA_MS,
  maximo: env.RATE_LIMIT_LOGIN_MAX,
});

authRutas.post('/registro', registro);
authRutas.post('/login', limiteLogin, login);
authRutas.get('/perfil', requiereAutenticacion, perfil);
