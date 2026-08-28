import {
  insertarUsuario,
  buscarUsuarioPorEmailConHash,
  buscarUsuarioPorId,
} from '../repositorios/usuariosRepo.js';
import { hashearPassword, compararPassword } from '../utils/password.js';
import { emitirToken } from '../utils/jwt.js';
import { validarRegistro, validarLogin } from '../utils/validacion.js';
import {
  errorDatosInvalidos,
  errorEmailDuplicado,
  errorCredencialesInvalidas,
  errorNoAutenticado,
} from '../utils/errores.js';

// Código de PostgreSQL para violación de restricción UNIQUE.
const VIOLACION_UNIQUE = '23505';

/** POST /api/auth/registro */
export async function registro(req, res, siguiente) {
  try {
    const { valido, detalles, datos } = validarRegistro(req.body);
    if (!valido) {
      throw errorDatosInvalidos(detalles);
    }

    const passwordHash = await hashearPassword(datos.password);

    let usuario;
    try {
      usuario = await insertarUsuario({
        email: datos.email,
        passwordHash,
        nombre: datos.nombre,
      });
    } catch (error) {
      // Se traduce sin exponer el nombre de la restricción ni el mensaje del driver.
      if (error.code === VIOLACION_UNIQUE) {
        throw errorEmailDuplicado();
      }
      throw error;
    }

    res.status(201).json({
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
    });
  } catch (error) {
    siguiente(error);
  }
}

/** POST /api/auth/login */
export async function login(req, res, siguiente) {
  try {
    const { valido, detalles, datos } = validarLogin(req.body);
    if (!valido) {
      throw errorDatosInvalidos(detalles);
    }

    const usuario = await buscarUsuarioPorEmailConHash(datos.email);

    // Email inexistente y contraseña incorrecta producen exactamente la misma
    // respuesta: nada debe revelar si el email existe en el sistema.
    if (!usuario) {
      throw errorCredencialesInvalidas();
    }

    const coincide = await compararPassword(datos.password, usuario.password_hash);
    if (!coincide) {
      throw errorCredencialesInvalidas();
    }

    const token = emitirToken({ id: usuario.id, email: usuario.email });

    // La respuesta se construye campo a campo: el hash traído por la consulta de
    // login no llega nunca al cuerpo.
    res.status(200).json({
      token,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
      },
    });
  } catch (error) {
    siguiente(error);
  }
}

/** GET /api/auth/perfil (protegido) */
export async function perfil(req, res, siguiente) {
  try {
    const usuario = await buscarUsuarioPorId(req.usuario.id);

    // El token es autosuficiente y no se consulta la base en cada petición, así
    // que un usuario eliminado conserva un token técnicamente válido hasta que
    // expire; su perfil ya no existe y la petición se rechaza como no autenticada.
    if (!usuario) {
      throw errorNoAutenticado('El usuario del token ya no existe.');
    }

    res.status(200).json({
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      creado_en: usuario.creado_en,
    });
  } catch (error) {
    siguiente(error);
  }
}
