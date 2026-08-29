import { Router } from 'express';
import { listar, crear, actualizar, eliminar } from '../controladores/categoriasControlador.js';

// Sin `requiereAutenticacion` ruta a ruta: aquí todas las rutas son protegidas,
// así que la autenticación se aplica al montar el router en app.js. Un endpoint
// nuevo queda protegido por el hecho de existir, y no por acordarse de añadirlo.
export const categoriasRutas = Router();

categoriasRutas.get('/', listar);
categoriasRutas.post('/', crear);
categoriasRutas.put('/:id', actualizar);
categoriasRutas.delete('/:id', eliminar);
