import express from 'express';
import cors from 'cors';
import { authRutas } from './rutas/authRutas.js';
import { manejadorErrores, manejadorNoEncontrado } from './middleware/errores.js';

export const app = express();

// El frontend correrá en un origen distinto (Vite), así que la SPA necesita CORS.
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRutas);

// Van al final y en este orden: primero el 404 de rutas no montadas, después el
// manejador de errores, que es el único que construye respuestas de error.
app.use(manejadorNoEncontrado);
app.use(manejadorErrores);
