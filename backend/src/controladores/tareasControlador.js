import {
  listarTareas,
  crearTarea,
  actualizarTarea,
  fijarCompletada as fijarCompletadaEnRepo,
  eliminarTarea,
} from '../repositorios/tareasRepo.js';
import {
  validarTarea,
  validarEstadoCompletada,
  validarConsultaTareas,
} from '../utils/validacion.js';
import { parsearIdRuta } from '../utils/identificadores.js';
import { errorDatosInvalidos, errorNoEncontrado } from '../utils/errores.js';

/**
 * El identificador del dueño sale siempre de `req.usuario`, que puso el
 * middleware de autenticación a partir del token. Ningún controlador de este
 * archivo lee un identificador de usuario del cuerpo, de la query ni de la
 * ruta: un `usuario_id` enviado por el cliente se ignora por no leerse nunca.
 *
 * El formato de los errores lo construye el middleware: aquí solo se lanzan
 * errores de aplicación y se delegan con `siguiente(error)`, de modo que ni una
 * traza de pila ni un mensaje del driver puedan llegar al cliente.
 */

// Mensaje único para la tarea que no existe y para la que es de otro usuario.
// Es deliberado que no haya dos: la respuesta no debe permitir distinguirlas.
const TAREA_NO_ENCONTRADA = 'La tarea solicitada no existe.';

/** GET /api/tareas */
export async function listar(req, res, siguiente) {
  try {
    const { valido, detalles, datos } = validarConsultaTareas(req.query);
    if (!valido) {
      throw errorDatosInvalidos(detalles);
    }

    const tareas = await listarTareas({
      usuarioId: req.usuario.id,
      filtros: datos.filtros,
      orden: datos.orden,
    });
    res.status(200).json(tareas);
  } catch (error) {
    siguiente(error);
  }
}

/** POST /api/tareas */
export async function crear(req, res, siguiente) {
  try {
    const { valido, detalles, datos } = validarTarea(req.body);
    if (!valido) {
      throw errorDatosInvalidos(detalles);
    }

    const tarea = await crearTarea({ usuarioId: req.usuario.id, datos });
    res.status(201).json(tarea);
  } catch (error) {
    siguiente(error);
  }
}

/** PUT /api/tareas/:id */
export async function actualizar(req, res, siguiente) {
  try {
    const id = parsearIdRuta(req.params.id);
    const { valido, detalles, datos } = validarTarea(req.body);
    if (!valido) {
      throw errorDatosInvalidos(detalles);
    }

    const tarea = await actualizarTarea({ id, usuarioId: req.usuario.id, datos });
    // Ausencia de fila: no existe, o existe y es de otro. Un solo camino, para
    // que ambos casos sean indistinguibles desde fuera.
    if (!tarea) {
      throw errorNoEncontrado(TAREA_NO_ENCONTRADA);
    }

    res.status(200).json(tarea);
  } catch (error) {
    siguiente(error);
  }
}

/** PATCH /api/tareas/:id/completar */
export async function fijarCompletada(req, res, siguiente) {
  try {
    const id = parsearIdRuta(req.params.id);
    const { valido, detalles, datos } = validarEstadoCompletada(req.body);
    if (!valido) {
      throw errorDatosInvalidos(detalles);
    }

    const tarea = await fijarCompletadaEnRepo({
      id,
      usuarioId: req.usuario.id,
      completada: datos.completada,
    });
    if (!tarea) {
      throw errorNoEncontrado(TAREA_NO_ENCONTRADA);
    }

    res.status(200).json(tarea);
  } catch (error) {
    siguiente(error);
  }
}

/** DELETE /api/tareas/:id */
export async function eliminar(req, res, siguiente) {
  try {
    const id = parsearIdRuta(req.params.id);
    const eliminada = await eliminarTarea({ id, usuarioId: req.usuario.id });
    if (!eliminada) {
      throw errorNoEncontrado(TAREA_NO_ENCONTRADA);
    }
    res.status(204).end();
  } catch (error) {
    siguiente(error);
  }
}
