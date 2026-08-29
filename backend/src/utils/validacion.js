const LONGITUD_MINIMA_PASSWORD = 8;
// bcrypt ignora los bytes que exceden 72: aceptar una contraseña más larga haría
// que dos contraseñas distintas abrieran la misma cuenta. Se rechaza en lugar de
// truncar en silencio.
const LONGITUD_MAXIMA_PASSWORD = 72;
const LONGITUD_MAXIMA_NOMBRE = 100;
const LONGITUD_MAXIMA_EMAIL = 254;
// Espejo exacto de los CHECK del esquema: categorias 1-100, etiquetas 1-50.
const LONGITUD_MAXIMA_NOMBRE_CATEGORIA = 100;
const LONGITUD_MAXIMA_NOMBRE_ETIQUETA = 50;
// Espejo exacto de los CHECK del esquema sobre tareas.
const LONGITUD_MAXIMA_TITULO = 200;
const LONGITUD_MAXIMA_DESCRIPCION = 2000;
// El texto de búsqueda no puede ser más largo que aquello en lo que busca.
const LONGITUD_MAXIMA_BUSQUEDA = LONGITUD_MAXIMA_TITULO;
// Tope de elementos de una lista de etiquetas, tanto en el filtro como en el
// cuerpo. Acota el tamaño de la entrada sin limitar cuántas tareas puede llegar
// a tener un usuario, que sigue siendo ilimitado.
const MAXIMO_ETIQUETAS = 50;

// Comprobación de forma, no de existencia: parte local, arroba, dominio con al
// menos un punto y sin espacios.
const PATRON_EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

function esCadenaNoVacia(valor) {
  return typeof valor === 'string' && valor.trim() !== '';
}

/**
 * Valida los datos de `POST /api/auth/registro`.
 * Devuelve { valido, detalles, datos }: `detalles` enumera los campos inválidos
 * y `datos` trae los valores ya normalizados cuando la validación pasa.
 */
export function validarRegistro(cuerpo) {
  const entrada = cuerpo ?? {};
  const detalles = {};

  const email = typeof entrada.email === 'string' ? entrada.email.trim() : entrada.email;
  if (!esCadenaNoVacia(email)) {
    detalles.email = 'El email es obligatorio.';
  } else if (email.length > LONGITUD_MAXIMA_EMAIL) {
    detalles.email = `El email no puede superar los ${LONGITUD_MAXIMA_EMAIL} caracteres.`;
  } else if (!PATRON_EMAIL.test(email)) {
    detalles.email = 'El email no tiene un formato válido.';
  }

  const problemaPassword = validarPassword(entrada.password);
  if (problemaPassword) {
    detalles.password = problemaPassword;
  }

  // El nombre es opcional: ausente o null es válido. Si viene, debe ser una
  // cadena con contenido, porque la cadena vacía sería un tercer estado
  // indistinguible de "sin nombre".
  let nombre = null;
  if (entrada.nombre !== undefined && entrada.nombre !== null) {
    if (typeof entrada.nombre !== 'string') {
      detalles.nombre = 'El nombre debe ser texto.';
    } else {
      const recortado = entrada.nombre.trim();
      if (recortado === '') {
        detalles.nombre = 'El nombre, si se envía, no puede estar vacío.';
      } else if (recortado.length > LONGITUD_MAXIMA_NOMBRE) {
        detalles.nombre = `El nombre no puede superar los ${LONGITUD_MAXIMA_NOMBRE} caracteres.`;
      } else {
        nombre = recortado;
      }
    }
  }

  const valido = Object.keys(detalles).length === 0;
  return {
    valido,
    detalles,
    datos: valido ? { email, password: entrada.password, nombre } : null,
  };
}

/**
 * Valida los datos de `POST /api/auth/login`. Solo comprueba presencia y forma:
 * no aplica las reglas de longitud de contraseña, para que un cambio futuro de
 * esas reglas no impida entrar a quien se registró con las anteriores.
 */
export function validarLogin(cuerpo) {
  const entrada = cuerpo ?? {};
  const detalles = {};

  const email = typeof entrada.email === 'string' ? entrada.email.trim() : entrada.email;
  if (!esCadenaNoVacia(email)) {
    detalles.email = 'El email es obligatorio.';
  }

  if (typeof entrada.password !== 'string' || entrada.password === '') {
    detalles.password = 'La contraseña es obligatoria.';
  }

  const valido = Object.keys(detalles).length === 0;
  return {
    valido,
    detalles,
    datos: valido ? { email, password: entrada.password } : null,
  };
}

/**
 * Regla de contraseña: entre 8 y 72 bytes en UTF-8, sin reglas de composición
 * (NIST SP 800-63B prioriza longitud sobre composición). El límite se cuenta en
 * bytes y no en caracteres porque una letra acentuada ocupa más de un byte.
 * Devuelve el problema encontrado, o null si es válida.
 */
export function validarPassword(password) {
  if (typeof password !== 'string' || password === '') {
    return 'La contraseña es obligatoria.';
  }

  const bytes = Buffer.byteLength(password, 'utf8');
  if (bytes < LONGITUD_MINIMA_PASSWORD) {
    return `La contraseña debe tener al menos ${LONGITUD_MINIMA_PASSWORD} caracteres.`;
  }
  if (bytes > LONGITUD_MAXIMA_PASSWORD) {
    return `La contraseña no puede superar los ${LONGITUD_MAXIMA_PASSWORD} bytes.`;
  }

  return null;
}


// Caracteres de control C0 y C1, incluidos el salto de línea y la tabulación. Un
// nombre es una etiqueta de una línea: un carácter de control ahí solo puede
// llegar por un pegado accidental o por un intento de ensuciar los registros.
const PATRON_CARACTERES_CONTROL = /\p{Cc}/u;

/**
 * Valida y normaliza el nombre de una categoría o de una etiqueta.
 *
 * La longitud se cuenta en puntos de código, no con `.length`, porque el CHECK
 * del esquema usa `char_length`: un emoji cuenta 1 en la base y 2 en UTF-16, así
 * que contar con `.length` rechazaría con 400 nombres que la base sí admite.
 *
 * La normalización a NFC es lo que impide que "café" compuesto y descompuesto
 * convivan como dos filas distintas: son cadenas diferentes para la restricción
 * UNIQUE, pero idénticas en pantalla.
 *
 * Devuelve { valido, detalles, datos } como el resto de validaciones.
 */
export function validarNombre(cuerpo, longitudMaxima) {
  const entrada = cuerpo ?? {};
  const detalles = {};
  let nombre = null;

  if (entrada.nombre === undefined || entrada.nombre === null) {
    detalles.nombre = 'El nombre es obligatorio.';
  } else if (typeof entrada.nombre !== 'string') {
    // Se distingue de la ausencia, como ya hace validarRegistro: quien envía un
    // número no ha olvidado el campo, lo ha enviado con el tipo equivocado.
    detalles.nombre = 'El nombre debe ser texto.';
  } else if (PATRON_CARACTERES_CONTROL.test(entrada.nombre)) {
    detalles.nombre = 'El nombre no puede contener saltos de línea ni caracteres de control.';
  } else {
    // Se recortan los extremos y se conservan los espacios interiores: reescribir
    // en silencio lo que alguien teclea es peor que respetarlo.
    const recortado = entrada.nombre.trim().normalize('NFC');
    if (recortado === '') {
      detalles.nombre = 'El nombre es obligatorio.';
    } else if ([...recortado].length > longitudMaxima) {
      detalles.nombre = `El nombre no puede superar los ${longitudMaxima} caracteres.`;
    } else {
      nombre = recortado;
    }
  }

  const valido = Object.keys(detalles).length === 0;
  return { valido, detalles, datos: valido ? { nombre } : null };
}


// -----------------------------------------------------------------------------
// Tareas
// -----------------------------------------------------------------------------

const PRIORIDADES = ['baja', 'media', 'alta'];
const PRIORIDAD_POR_DEFECTO = 'media';

// Cualquier carácter de control salvo el salto de línea. La descripción es un
// texto de varios párrafos y el salto de línea le es propio; el resto
// (tabuladores, nulos, caracteres C1) solo llega por un pegado accidental o por
// un intento de ensuciar los registros.
const PATRON_CONTROL_EXCEPTO_SALTO = /(?!\n)\p{Cc}/u;

// Mismos identificadores que acepta la ruta: enteros positivos sin ceros a la
// izquierda. Se manejan como cadena porque las claves son BIGINT y su valor
// puede exceder la precisión de un número de JavaScript.
const PATRON_IDENTIFICADOR = /^[1-9][0-9]*$/;

/**
 * Campos de ordenación admitidos y dirección por defecto de cada uno. La
 * dirección vive junto al campo y no en un `if` del controlador porque es un
 * atributo del campo: añadir uno nuevo obliga a decidir su dirección aquí
 * mismo. Las expresiones SQL correspondientes viven en el repositorio.
 */
const ORDENACIONES_ADMITIDAS = {
  creado_en: 'desc',
  fecha_vencimiento: 'asc',
  prioridad: 'desc',
  titulo: 'asc',
};
const DIRECCIONES_ADMITIDAS = ['asc', 'desc'];

// Valor reservado del filtro de categoría que designa la ausencia de categoría.
// No puede colisionar con ningún identificador porque estos son solo dígitos.
const CATEGORIA_SIN_ASIGNAR = 'ninguna';

/** Normaliza un texto: recorta los extremos y lo lleva a la forma Unicode NFC. */
function normalizarTexto(valor) {
  return valor.trim().normalize('NFC');
}

/**
 * Longitud tal como la percibe la persona y como la cuenta `char_length` en el
 * CHECK del esquema. `.length` contaría 2 por cada emoji y rechazaría con 400
 * títulos que la base sí admite.
 */
function longitud(texto) {
  return [...texto].length;
}

/**
 * Valida una fecha con forma AAAA-MM-DD que además exprese un día real del
 * calendario. `new Date('2025-02-30')` no lanza: desborda a marzo, así que hay
 * que comprobar que los componentes sobreviven a la ida y vuelta.
 */
function fechaValida(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return false;
  }
  const [anio, mes, dia] = valor.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
}

/** Un identificador válido, devuelto como cadena, o null si no lo es. */
function comoIdentificador(valor) {
  if (typeof valor === 'string' && PATRON_IDENTIFICADOR.test(valor)) {
    return valor;
  }
  // Un cliente escrito en JavaScript puede enviarlo como número si lo construyó
  // él mismo; se acepta mientras no haya perdido precisión.
  if (typeof valor === 'number' && Number.isSafeInteger(valor) && valor > 0) {
    return String(valor);
  }
  return null;
}

/**
 * Valida el cuerpo de `POST /api/tareas` y de `PUT /api/tareas/:id`.
 *
 * Los campos que el endpoint no reconoce se ignoran por no leerse nunca, y
 * `usuario_id`, `estado`, `completada`, `creado_en`, `actualizado_en` y
 * `completada_en` entran en esa categoría: el dueño sale del token y el estado
 * de completada solo cambia por su endpoint propio.
 *
 * Las etiquetas salen como `null` cuando el campo no venía y como array cuando
 * sí: la diferencia entre "conservar las actuales" y "quitarlas todas" es la
 * presencia de la clave, no su valor.
 */
export function validarTarea(cuerpo) {
  const entrada = cuerpo ?? {};
  const detalles = {};

  let titulo = null;
  if (entrada.titulo === undefined || entrada.titulo === null) {
    detalles.titulo = 'El título es obligatorio.';
  } else if (typeof entrada.titulo !== 'string') {
    detalles.titulo = 'El título debe ser texto.';
  } else if (PATRON_CARACTERES_CONTROL.test(entrada.titulo)) {
    detalles.titulo = 'El título no puede contener saltos de línea ni caracteres de control.';
  } else {
    const normalizado = normalizarTexto(entrada.titulo);
    if (normalizado === '') {
      detalles.titulo = 'El título es obligatorio.';
    } else if (longitud(normalizado) > LONGITUD_MAXIMA_TITULO) {
      detalles.titulo = `El título no puede superar los ${LONGITUD_MAXIMA_TITULO} caracteres.`;
    } else {
      titulo = normalizado;
    }
  }

  // Campo opcional: ausente, null o vacío significan "sin descripción".
  let descripcion = null;
  if (entrada.descripcion !== undefined && entrada.descripcion !== null) {
    if (typeof entrada.descripcion !== 'string') {
      detalles.descripcion = 'La descripción debe ser texto.';
    } else if (PATRON_CONTROL_EXCEPTO_SALTO.test(entrada.descripcion)) {
      detalles.descripcion =
        'La descripción no puede contener caracteres de control distintos del salto de línea.';
    } else {
      const normalizada = normalizarTexto(entrada.descripcion);
      if (longitud(normalizada) > LONGITUD_MAXIMA_DESCRIPCION) {
        detalles.descripcion = `La descripción no puede superar los ${LONGITUD_MAXIMA_DESCRIPCION} caracteres.`;
      } else {
        descripcion = normalizada === '' ? null : normalizada;
      }
    }
  }

  let prioridad = PRIORIDAD_POR_DEFECTO;
  if (entrada.prioridad !== undefined && entrada.prioridad !== null && entrada.prioridad !== '') {
    if (!PRIORIDADES.includes(entrada.prioridad)) {
      detalles.prioridad = `La prioridad debe ser ${PRIORIDADES.join(', ')}.`;
    } else {
      prioridad = entrada.prioridad;
    }
  }

  let fechaVencimiento = null;
  if (
    entrada.fecha_vencimiento !== undefined &&
    entrada.fecha_vencimiento !== null &&
    entrada.fecha_vencimiento !== ''
  ) {
    if (!fechaValida(entrada.fecha_vencimiento)) {
      detalles.fecha_vencimiento =
        'La fecha de vencimiento debe expresar un día válido con la forma AAAA-MM-DD.';
    } else {
      fechaVencimiento = entrada.fecha_vencimiento;
    }
  }

  let categoriaId = null;
  if (entrada.categoria_id !== undefined && entrada.categoria_id !== null && entrada.categoria_id !== '') {
    categoriaId = comoIdentificador(entrada.categoria_id);
    if (categoriaId === null) {
      detalles.categoria_id = 'La categoría debe indicarse con un identificador válido.';
    }
  }

  // null = campo ausente (conservar); array = sustituir por exactamente estas.
  let etiquetas = null;
  if (entrada.etiquetas !== undefined && entrada.etiquetas !== null) {
    if (!Array.isArray(entrada.etiquetas)) {
      detalles.etiquetas = 'Las etiquetas deben enviarse como una lista de identificadores.';
    } else if (entrada.etiquetas.length > MAXIMO_ETIQUETAS) {
      detalles.etiquetas = `No se pueden indicar más de ${MAXIMO_ETIQUETAS} etiquetas.`;
    } else {
      const identificadores = entrada.etiquetas.map(comoIdentificador);
      if (identificadores.some((identificador) => identificador === null)) {
        detalles.etiquetas = 'Cada etiqueta debe indicarse con un identificador válido.';
      } else {
        etiquetas = identificadores;
      }
    }
  }

  const valido = Object.keys(detalles).length === 0;
  return {
    valido,
    detalles,
    datos: valido
      ? {
          titulo,
          descripcion,
          prioridad,
          fecha_vencimiento: fechaVencimiento,
          categoria_id: categoriaId,
          etiquetas,
        }
      : null,
  };
}

/**
 * Valida el cuerpo de `PATCH /api/tareas/:id/completar`.
 *
 * El booleano se exige estricto: `"true"` y `1` se rechazan en lugar de
 * interpretarse, porque el endpoint no alterna y una interpretación laxa haría
 * que un cliente con un error de tipo cambiara el estado sin darse cuenta.
 */
export function validarEstadoCompletada(cuerpo) {
  const entrada = cuerpo ?? {};
  const detalles = {};

  if (typeof entrada.completada !== 'boolean') {
    detalles.completada = 'El campo completada es obligatorio y debe ser verdadero o falso.';
  }

  const valido = Object.keys(detalles).length === 0;
  return { valido, detalles, datos: valido ? { completada: entrada.completada } : null };
}

/**
 * Lee un parámetro de consulta de valor único. Express entrega un array cuando
 * el parámetro llega repetido en la URL: aplicar solo uno de los dos valores en
 * silencio daría un resultado que quien consulta no ha pedido.
 */
function leerValorUnico(valor) {
  if (Array.isArray(valor)) {
    return { repetido: true };
  }
  if (valor === undefined || valor === null) {
    return { ausente: true };
  }
  if (typeof valor !== 'string') {
    // Express entrega un objeto si la URL usa la sintaxis a[b]=c.
    return { invalido: true };
  }
  return { valor };
}

/**
 * Valida y normaliza los parámetros de `GET /api/tareas`.
 *
 * Ningún valor no admitido se descarta en silencio: descartarlo devolvería una
 * lista que parece la respuesta a la pregunta que se hizo sin serlo. La única
 * excepción es la búsqueda vacía, que la especificación define como ausencia de
 * valor y no como valor inválido, porque es lo que envía un cuadro de búsqueda
 * al que se le acaba de borrar el texto.
 *
 * Los parámetros que no aparecen aquí se ignoran por no leerse nunca.
 */
export function validarConsultaTareas(query) {
  const entrada = query ?? {};
  const detalles = {};
  const filtros = {};

  const leer = (nombre) => {
    const lectura = leerValorUnico(entrada[nombre]);
    if (lectura.repetido) {
      detalles[nombre] = 'Este parámetro admite un único valor.';
      return undefined;
    }
    if (lectura.invalido) {
      detalles[nombre] = 'El valor de este parámetro no es válido.';
      return undefined;
    }
    return lectura.ausente ? undefined : lectura.valor;
  };

  const completada = leer('completada');
  if (completada !== undefined && completada !== '') {
    if (completada !== 'true' && completada !== 'false') {
      detalles.completada = 'El filtro completada debe ser true o false.';
    } else {
      filtros.completada = completada === 'true';
    }
  }

  const categoria = leer('categoria');
  if (categoria !== undefined && categoria !== '') {
    if (categoria === CATEGORIA_SIN_ASIGNAR) {
      filtros.categoria = CATEGORIA_SIN_ASIGNAR;
    } else {
      const identificador = comoIdentificador(categoria);
      if (identificador === null) {
        detalles.categoria = `El filtro categoria debe ser un identificador válido o "${CATEGORIA_SIN_ASIGNAR}".`;
      } else {
        filtros.categoria = identificador;
      }
    }
  }

  const prioridad = leer('prioridad');
  if (prioridad !== undefined && prioridad !== '') {
    if (!PRIORIDADES.includes(prioridad)) {
      detalles.prioridad = `El filtro prioridad debe ser ${PRIORIDADES.join(', ')}.`;
    } else {
      filtros.prioridad = prioridad;
    }
  }

  for (const nombre of ['fecha_vencimiento_desde', 'fecha_vencimiento_hasta']) {
    const fecha = leer(nombre);
    if (fecha !== undefined && fecha !== '') {
      if (!fechaValida(fecha)) {
        detalles[nombre] = 'La fecha debe expresar un día válido con la forma AAAA-MM-DD.';
      } else {
        filtros[nombre] = fecha;
      }
    }
  }

  const busqueda = leer('busqueda');
  if (busqueda !== undefined) {
    if (longitud(busqueda) > LONGITUD_MAXIMA_BUSQUEDA) {
      detalles.busqueda = `El texto de búsqueda no puede superar los ${LONGITUD_MAXIMA_BUSQUEDA} caracteres.`;
    } else {
      // Vacía o formada solo por espacios: se trata como si el parámetro no se
      // hubiera enviado. Nunca se rechaza.
      const texto = normalizarTexto(busqueda);
      if (texto !== '') {
        filtros.busqueda = texto;
      }
    }
  }

  // Las etiquetas son una lista por naturaleza: llegan repetidas en la URL
  // (etiquetas=casa&etiquetas=urgente) y un solo valor es una lista de uno.
  const etiquetasCrudas = entrada.etiquetas;
  if (etiquetasCrudas !== undefined && etiquetasCrudas !== null) {
    const lista = Array.isArray(etiquetasCrudas) ? etiquetasCrudas : [etiquetasCrudas];
    if (lista.length > MAXIMO_ETIQUETAS) {
      detalles.etiquetas = `No se pueden indicar más de ${MAXIMO_ETIQUETAS} etiquetas.`;
    } else if (lista.some((nombre) => typeof nombre !== 'string')) {
      detalles.etiquetas = 'Cada etiqueta debe indicarse por su nombre.';
    } else {
      const nombres = lista.map(normalizarTexto).filter((nombre) => nombre !== '');
      if (nombres.length > 0) {
        filtros.etiquetas = nombres;
      }
    }
  }

  const ordenar = leer('ordenar');
  let campoOrden = 'creado_en';
  if (ordenar !== undefined && ordenar !== '') {
    // Lista blanca: una clave que no está en el mapa no produce un orden
    // alternativo, produce un 400 antes de llegar al repositorio. Es la única
    // barrera real entre el cliente y la cláusula ORDER BY.
    if (!Object.hasOwn(ORDENACIONES_ADMITIDAS, ordenar)) {
      detalles.ordenar = `El campo de ordenación debe ser ${Object.keys(ORDENACIONES_ADMITIDAS).join(', ')}.`;
    } else {
      campoOrden = ordenar;
    }
  }

  const direccion = leer('direccion');
  let direccionOrden = null;
  if (direccion !== undefined && direccion !== '') {
    if (!DIRECCIONES_ADMITIDAS.includes(direccion)) {
      detalles.direccion = `La dirección de ordenación debe ser ${DIRECCIONES_ADMITIDAS.join(' o ')}.`;
    } else {
      direccionOrden = direccion;
    }
  }

  const valido = Object.keys(detalles).length === 0;
  return {
    valido,
    detalles,
    datos: valido
      ? {
          filtros,
          orden: {
            campo: campoOrden,
            // La dirección explícita prevalece siempre sobre la de por defecto
            // del campo, que solo se aplica cuando no viene ninguna.
            direccion: direccionOrden ?? ORDENACIONES_ADMITIDAS[campoOrden],
          },
        }
      : null,
  };
}

export {
  LONGITUD_MINIMA_PASSWORD,
  LONGITUD_MAXIMA_PASSWORD,
  LONGITUD_MAXIMA_NOMBRE,
  LONGITUD_MAXIMA_NOMBRE_CATEGORIA,
  LONGITUD_MAXIMA_NOMBRE_ETIQUETA,
  LONGITUD_MAXIMA_TITULO,
  LONGITUD_MAXIMA_DESCRIPCION,
  LONGITUD_MAXIMA_BUSQUEDA,
  MAXIMO_ETIQUETAS,
  PRIORIDADES,
  ORDENACIONES_ADMITIDAS,
  DIRECCIONES_ADMITIDAS,
  CATEGORIA_SIN_ASIGNAR,
};
