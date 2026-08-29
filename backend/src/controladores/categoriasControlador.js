import {
  listarCategorias,
  insertarCategoria,
  actualizarCategoria,
  eliminarCategoria,
} from '../repositorios/categoriasRepo.js';
import { validarNombre, LONGITUD_MAXIMA_NOMBRE_CATEGORIA } from '../utils/validacion.js';
import { parsearIdRuta } from '../utils/identificadores.js';
import { errorDatosInvalidos, errorNombreDuplicado, errorNoEncontrado } from '../utils/errores.js';

// Código de PostgreSQL para violación de restricción UNIQUE.
const VIOLACION_UNIQUE = '23505';
// Solo esta restricción se traduce a 409. Cualquier otra violación de unicidad
// sería un fallo no previsto y debe propagarse como error interno en lugar de
// disfrazarse de nombre duplicado. El nombre se usa para decidir, nunca se
// devuelve al cliente.
const RESTRICCION_NOMBRE = 'categorias_usuario_nombre_unico';

function traducirDuplicado(error) {
  if (error.code === VIOLACION_UNIQUE && error.constraint === RESTRICCION_NOMBRE) {
    return errorNombreDuplicado('categoria');
  }
  return error;
}

/**
 * El identificador del dueño sale siempre de `req.usuario`, que puso el
 * middleware de autenticación a partir del token. Ningún controlador de este
 * archivo lee un identificador de usuario del cuerpo, de la query ni de la ruta:
 * un `usuario_id` enviado por el cliente se ignora por no leerse nunca.
 */

/** GET /api/categorias */
export async function listar(req, res, siguiente) {
  try {
    res.status(200).json(await listarCategorias({ usuarioId: req.usuario.id }));
  } catch (error) {
    siguiente(error);
  }
}

/** POST /api/categorias */
export async function crear(req, res, siguiente) {
  try {
    const { valido, detalles, datos } = validarNombre(req.body, LONGITUD_MAXIMA_NOMBRE_CATEGORIA);
    if (!valido) {
      throw errorDatosInvalidos(detalles);
    }

    let categoria;
    try {
      categoria = await insertarCategoria({ usuarioId: req.usuario.id, nombre: datos.nombre });
    } catch (error) {
      throw traducirDuplicado(error);
    }

    res.status(201).json(categoria);
  } catch (error) {
    siguiente(error);
  }
}

/** PUT /api/categorias/:id */
export async function actualizar(req, res, siguiente) {
  try {
    const id = parsearIdRuta(req.params.id);
    const { valido, detalles, datos } = validarNombre(req.body, LONGITUD_MAXIMA_NOMBRE_CATEGORIA);
    if (!valido) {
      throw errorDatosInvalidos(detalles);
    }

    let categoria;
    try {
      categoria = await actualizarCategoria({ id, usuarioId: req.usuario.id, nombre: datos.nombre });
    } catch (error) {
      throw traducirDuplicado(error);
    }

    // Ausencia de fila: no existe, o existe y es de otro. Un solo camino, para
    // que ambos casos sean indistinguibles desde fuera.
    if (!categoria) {
      throw errorNoEncontrado('La categoría solicitada no existe.');
    }

    res.status(200).json(categoria);
  } catch (error) {
    siguiente(error);
  }
}

/** DELETE /api/categorias/:id */
export async function eliminar(req, res, siguiente) {
  try {
    const id = parsearIdRuta(req.params.id);
    const eliminada = await eliminarCategoria({ id, usuarioId: req.usuario.id });
    if (!eliminada) {
      throw errorNoEncontrado('La categoría solicitada no existe.');
    }
    res.status(204).end();
  } catch (error) {
    siguiente(error);
  }
}
