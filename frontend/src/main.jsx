import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.jsx';
import { LimiteDeError } from './componentes/Comunes/LimiteDeError.jsx';
import { ProveedorAuth } from './contexto/ContextoAuth.jsx';
import { ProveedorTema } from './contexto/ContextoTema.jsx';
import './estilos/global.css';

// El proveedor de tema va lo más afuera posible: no depende del router ni de la
// sesión y así el atributo `data-theme` queda fijado para todo el árbol. El
// proveedor de sesión va dentro del router: el guardián de rutas necesita
// ambos, y las redirecciones se resuelven con el estado de sesión ya disponible.
createRoot(document.getElementById('raiz')).render(
  <StrictMode>
    <ProveedorTema>
      <BrowserRouter>
        <ProveedorAuth>
          <LimiteDeError>
            <App />
          </LimiteDeError>
        </ProveedorAuth>
      </BrowserRouter>
    </ProveedorTema>
  </StrictMode>,
);
