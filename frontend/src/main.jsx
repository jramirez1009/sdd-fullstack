import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.jsx';
import { ProveedorAuth } from './contextos/ContextoAuth.jsx';
import './estilos/global.css';

// El proveedor de sesión va dentro del router: el guardián de rutas necesita
// ambos, y las redirecciones se resuelven con el estado de sesión ya disponible.
createRoot(document.getElementById('raiz')).render(
  <StrictMode>
    <BrowserRouter>
      <ProveedorAuth>
        <App />
      </ProveedorAuth>
    </BrowserRouter>
  </StrictMode>,
);
