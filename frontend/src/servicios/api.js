/**
 * Único punto del cliente que habla HTTP con la API.
 *
 * Concentra tres responsabilidades que ninguna pantalla debe repetir: adjuntar
 * el JWT de la sesión vigente, normalizar cualquier fallo a un `ErrorApi`, y
 * reaccionar a un `401` cerrando la sesión. Ningún componente hace `fetch` por
 * su cuenta.
 */

// Sin barra final: las rutas se escriben con barra inicial. Si la variable no
// está definida se usa el puerto del backend en desarrollo.
const URL_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

/** Código propio, no de la API: un fallo de red no tiene respuesta que leer. */
export const ERROR_RED = 'ERROR_RED';

/**
 * Forma única de todo error que sale de este módulo, venga de una respuesta de
 * la API o de un fallo de transporte. `estadoHttp` es 0 cuando no hubo
 * respuesta, lo que permite a la interfaz distinguir "no he podido preguntar"
 * de "me han dicho que no".
 */
export class ErrorApi extends Error {
  constructor({ estadoHttp, codigo, mensaje, detalles }) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.estadoHttp = estadoHttp;
    this.codigo = codigo;
    this.mensaje = mensaje;
    this.detalles = detalles ?? null;
  }

  /** Verdadero cuando la petición no llegó a obtener respuesta del servidor. */
  get esFalloDeRed() {
    return this.estadoHttp === 0;
  }
}

// Copia del token vigente fuera de React. La fuente de verdad sigue siendo el
// estado de ContextoAuth, que la mantiene sincronizada desde un único efecto.
let tokenVigente = null;

// Manejador que el contexto registra para enterarse de que la sesión ha
// caducado. Mientras no lo registre, un 401 solo produce el error.
let alPerderSesion = null;

/** Fija el token que viajará en las siguientes peticiones. `null` lo retira. */
export function establecerToken(token) {
  tokenVigente = token ?? null;
}

/** Registra el manejador de sesión caducada. Devuelve la función para retirarlo. */
export function registrarManejadorSesionCaducada(manejador) {
  alPerderSesion = manejador ?? null;
  return () => {
    if (alPerderSesion === manejador) {
      alPerderSesion = null;
    }
  };
}

/**
 * Lee el cuerpo de la respuesta como JSON. Devuelve null si viene vacío o si no
 * es JSON: un error de la API que llegue sin cuerpo analizable no debe romper
 * el manejo del error, solo dejarlo sin detalles.
 */
async function leerCuerpo(respuesta) {
  const texto = await respuesta.text();
  if (texto === '') {
    return null;
  }
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

/**
 * Realiza una petición a la API.
 *
 * - `cuerpo`: objeto que se envía como JSON. Su presencia es lo que fija la
 *   cabecera `Content-Type`.
 * - `esAutenticacion`: marca las llamadas cuyo `401` significa "credenciales
 *   incorrectas" o "token guardado ya inválido" y no "la sesión ha caducado
 *   mientras usabas la aplicación". Ver design.md § 5.
 *
 * Devuelve el cuerpo ya analizado. Lanza siempre `ErrorApi`.
 */
export async function peticion(ruta, { metodo = 'GET', cuerpo, esAutenticacion = false } = {}) {
  const cabeceras = {};

  if (cuerpo !== undefined) {
    cabeceras['Content-Type'] = 'application/json';
  }
  if (tokenVigente) {
    cabeceras.Authorization = `Bearer ${tokenVigente}`;
  }

  let respuesta;
  try {
    respuesta = await fetch(`${URL_BASE}${ruta}`, {
      method: metodo,
      headers: cabeceras,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    // `fetch` solo rechaza cuando no ha habido respuesta: servidor caído, DNS,
    // CORS bloqueado o red sin salida. No se propaga la excepción original
    // porque su mensaje varía por navegador y no aporta nada al usuario.
    throw new ErrorApi({
      estadoHttp: 0,
      codigo: ERROR_RED,
      mensaje: 'No se ha podido conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.',
    });
  }

  const datos = await leerCuerpo(respuesta);

  if (respuesta.ok) {
    return datos;
  }

  // La API responde { error: { codigo, mensaje, detalles? } }. Si algo devuelve
  // otra cosa (un proxy, una pasarela), se rellena con lo que se sabe seguro.
  const error = datos?.error ?? {};
  const errorApi = new ErrorApi({
    estadoHttp: respuesta.status,
    codigo: error.codigo ?? 'ERROR_INTERNO',
    mensaje: error.mensaje ?? 'Se produjo un error inesperado. Inténtalo de nuevo más tarde.',
    detalles: error.detalles,
  });

  // Un 401 en cualquier llamada que no sea de autenticación significa que el
  // token ha dejado de valer: se cierra la sesión desde aquí, para que ninguna
  // pantalla —ni las que aún no existen— tenga que acordarse de hacerlo.
  if (respuesta.status === 401 && !esAutenticacion) {
    alPerderSesion?.();
  }

  // Se lanza en ambos casos: quien llamó no debe seguir como si nada.
  throw errorApi;
}

// -----------------------------------------------------------------------------
// Llamadas por endpoint
// -----------------------------------------------------------------------------

/** POST /api/auth/registro → { id, email, nombre }. No devuelve token. */
export function registrar(email, password) {
  return peticion('/api/auth/registro', {
    metodo: 'POST',
    cuerpo: { email, password },
    esAutenticacion: true,
  });
}

/** POST /api/auth/login → { token, usuario }. */
export function login(email, password) {
  return peticion('/api/auth/login', {
    metodo: 'POST',
    cuerpo: { email, password },
    esAutenticacion: true,
  });
}

/**
 * GET /api/auth/perfil → datos públicos del usuario.
 *
 * Va marcada como de autenticación: es la comprobación del arranque, y su 401
 * significa "el token guardado ya no vale", que el contexto maneja descartando
 * el token, no una caducidad ocurrida mientras se usaba la aplicación.
 */
export function perfil() {
  return peticion('/api/auth/perfil', { esAutenticacion: true });
}

// -----------------------------------------------------------------------------
// Categorías
// -----------------------------------------------------------------------------

/** GET /api/categorias → array de { id, nombre, fecha_creacion }, ordenado por nombre. */
export function listarCategorias() {
  return peticion('/api/categorias');
}

/** POST /api/categorias { nombre } → 201 con la categoría. */
export function crearCategoria(nombre) {
  return peticion('/api/categorias', { metodo: 'POST', cuerpo: { nombre } });
}

/** PUT /api/categorias/:id { nombre } → 200 con la categoría. */
export function editarCategoria(id, nombre) {
  return peticion(`/api/categorias/${id}`, { metodo: 'PUT', cuerpo: { nombre } });
}

/** DELETE /api/categorias/:id → 204 sin cuerpo; `peticion` devuelve null. */
export function eliminarCategoria(id) {
  return peticion(`/api/categorias/${id}`, { metodo: 'DELETE' });
}

// -----------------------------------------------------------------------------
// Tareas
// -----------------------------------------------------------------------------

/**
 * Construye la query string de `GET /api/tareas` a partir del objeto de filtros
 * ya normalizado a los nombres de parámetro del backend. Las claves de valor
 * neutro (`undefined`, `null`, `''`, lista vacía) se omiten. La lista
 * `etiquetas` se serializa como una entrada repetida por nombre
 * (`etiquetas=casa&etiquetas=urgente`), que es lo que espera el parser del
 * backend (`validarConsultaTareas`).
 */
function construirQueryTareas(filtros = {}) {
  const params = new URLSearchParams();

  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor === undefined || valor === null || valor === '') {
      continue;
    }
    if (clave === 'etiquetas') {
      for (const nombre of valor) {
        if (nombre !== undefined && nombre !== null && `${nombre}`.trim() !== '') {
          params.append('etiquetas', nombre);
        }
      }
      continue;
    }
    params.append(clave, typeof valor === 'boolean' ? String(valor) : valor);
  }

  const cadena = params.toString();
  return cadena === '' ? '' : `?${cadena}`;
}

/** GET /api/tareas?<query> → array de tareas del usuario. */
export function listarTareas(filtros) {
  return peticion(`/api/tareas${construirQueryTareas(filtros)}`);
}

/** POST /api/tareas → 201 con la tarea. `datos`: { titulo, descripcion?, prioridad?, fecha_vencimiento?, categoria_id?, etiquetas? }. */
export function crearTarea(datos) {
  return peticion('/api/tareas', { metodo: 'POST', cuerpo: datos });
}

/** PUT /api/tareas/:id → 200 con la tarea. */
export function editarTarea(id, datos) {
  return peticion(`/api/tareas/${id}`, { metodo: 'PUT', cuerpo: datos });
}

/** PATCH /api/tareas/:id/completar { completada } → 200 con la tarea. Idempotente. */
export function cambiarCompletada(id, done) {
  return peticion(`/api/tareas/${id}/completar`, {
    metodo: 'PATCH',
    cuerpo: { completada: done },
  });
}

/** DELETE /api/tareas/:id → 204 sin cuerpo; `peticion` devuelve null. */
export function eliminarTarea(id) {
  return peticion(`/api/tareas/${id}`, { metodo: 'DELETE' });
}

// -----------------------------------------------------------------------------
// Etiquetas
// -----------------------------------------------------------------------------

/** GET /api/etiquetas → array de { id, nombre, creado_en }, ordenado por nombre. */
export function listarEtiquetas() {
  return peticion('/api/etiquetas');
}

/** POST /api/etiquetas { nombre } → 201 con la etiqueta. `409 NOMBRE_DUPLICADO` si ya existe. */
export function crearEtiqueta(nombre) {
  return peticion('/api/etiquetas', { metodo: 'POST', cuerpo: { nombre } });
}
