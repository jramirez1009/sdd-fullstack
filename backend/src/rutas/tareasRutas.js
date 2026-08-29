import { Router } from 'express';
import {
  listar,
  crear,
  actualizar,
  fijarCompletada,
  eliminar,
} from '../controladores/tareasControlador.js';

// Sin `requiereAutenticacion` ruta a ruta: aquí todas las rutas son protegidas,
// así que la autenticación se aplica al montar el router en app.js. Un endpoint
// nuevo queda protegido por el hecho de existir, y no por acordarse de añadirlo.
export const tareasRutas = Router();

tareasRutas.get('/', listar);
tareasRutas.post('/', crear);
tareasRutas.put('/:id', actualizar);
// PATCH y no PUT: cambia un solo aspecto de la tarea, y lleva su propio endpoint
// porque el estado de completada no se puede cambiar desde la edición.
tareasRutas.patch('/:id/completar', fijarCompletada);
tareasRutas.delete('/:id', eliminar);
