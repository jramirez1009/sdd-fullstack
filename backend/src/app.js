import express from 'express';
import cors from 'cors';
import { authRutas } from './rutas/authRutas.js';
import { categoriasRutas } from './rutas/categoriasRutas.js';
import { etiquetasRutas } from './rutas/etiquetasRutas.js';
import { tareasRutas } from './rutas/tareasRutas.js';
import { requiereAutenticacion } from './middleware/autenticacion.js';
import { manejadorErrores, manejadorNoEncontrado } from './middleware/errores.js';

export const app = express();

// El frontend correrá en un origen distinto (Vite), así que la SPA necesita CORS.
app.use(cors());
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
