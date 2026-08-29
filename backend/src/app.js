import express from 'express';
import cors from 'cors';
import { authRutas } from './rutas/authRutas.js';
import { categoriasRutas } from './rutas/categoriasRutas.js';
import { etiquetasRutas } from './rutas/etiquetasRutas.js';
import { tareasRutas } from './rutas/tareasRutas.js';
import { requiereAutenticacion } from './middleware/autenticacion.js';
import { manejadorErrores, manejadorNoEncontrado } from './middleware/errores.js';
import { crearRegistroPeticiones } from './middleware/registro.js';
import { crearLimitePeticiones } from './middleware/limitePeticiones.js';
import { env } from './config/env.js';

export const app = express();

// Aquí y no en server.js: es una propiedad de la aplicación Express, y dejarla
// en el arranque del servidor la haría inaccesible a un test que importe `app`
// directamente, que es donde hay que verificar que el límite no se esquiva
// falsificando X-Forwarded-For.
app.set('trust proxy', env.TRUST_PROXY);

// El registro va el primero de todos: debe ver todas las peticiones, incluidas
// las que el límite rechaza sin llegar a ejecutar ninguna lógica.
app.use(crearRegistroPeticiones({ formato: env.LOG_FORMATO, nivel: env.LOG_NIVEL }));

// El frontend correrá en un origen distinto (Vite), así que la SPA necesita CORS.
// Es la única excepción al principio de "rechazar cuanto antes": sin sus
// cabeceras, el navegador oculta a la SPA la respuesta 429 y el frontend ve un
// fallo de red indistinguible de un servidor caído. Además deja fuera del
// conteo la comprobación previa OPTIONS, que la añade el navegador y no la
// aplicación.
app.use(cors());

// Antes de express.json(): no tiene sentido analizar el cuerpo de una petición
// que se va a rechazar.
app.use(crearLimitePeticiones({ ventanaMs: env.RATE_LIMIT_VENTANA_MS, maximo: env.RATE_LIMIT_MAX }));

app.use(express.json());

app.use('/api/auth', authRutas);

// La autenticación se aplica al montar, no ruta a ruta: estos routers no tienen
// ninguna ruta pública, así que protegerlos aquí elimina la posibilidad de que
// una ruta futura se quede sin proteger.
app.use('/api/categorias', requiereAutenticacion, categoriasRutas);
app.use('/api/etiquetas', requiereAutenticacion, etiquetasRutas);
app.use('/api/tareas', requiereAutenticacion, tareasRutas);

// Van al final y en este orden: primero el 404 de rutas no montadas, después el
// manejador de errores, que es el único que construye respuestas de error.
app.use(manejadorNoEncontrado);
app.use(manejadorErrores);
