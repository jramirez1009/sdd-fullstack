import { Router } from 'express';
import { registro, login, perfil } from '../controladores/authControlador.js';
import { requiereAutenticacion } from '../middleware/autenticacion.js';

export const authRutas = Router();

authRutas.post('/registro', registro);
authRutas.post('/login', login);
authRutas.get('/perfil', requiereAutenticacion, perfil);
