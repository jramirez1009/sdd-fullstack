import { Router } from 'express';
import { listar, crear, actualizar, eliminar } from '../controladores/etiquetasControlador.js';

// Sin `requiereAutenticacion` ruta a ruta: aquí todas las rutas son protegidas,
// así que la autenticación se aplica al montar el router en app.js. Un endpoint
// nuevo queda protegido por el hecho de existir, y no por acordarse de añadirlo.
export const etiquetasRutas = Router();

etiquetasRutas.get('/', listar);
etiquetasRutas.post('/', crear);
etiquetasRutas.put('/:id', actualizar);
etiquetasRutas.delete('/:id', eliminar);
