import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// La URL de la API no se configura aquí: viaja en VITE_API_URL y se lee en
// servicios/api.js, de modo que el mismo mecanismo sirva en desarrollo y en
// producción. Un proxy de desarrollo solo existiría durante `vite dev`.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
