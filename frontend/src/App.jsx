import { Navigate, Route, Routes } from 'react-router-dom';
import { RutaProtegida, RutaSoloAnonima } from './componentes/Comunes/RutaProtegida.jsx';
import { Login } from './paginas/Login.jsx';
import { Registro } from './paginas/Registro.jsx';
import { Tareas } from './paginas/Tareas.jsx';

export function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={(
          <RutaSoloAnonima>
            <Login />
          </RutaSoloAnonima>
        )}
      />
      <Route
        path="/registro"
        element={(
          <RutaSoloAnonima>
            <Registro />
          </RutaSoloAnonima>
        )}
      />
      <Route
        path="/tareas"
        element={(
          <RutaProtegida>
            <Tareas />
          </RutaProtegida>
        )}
      />
      {/*
        Cualquier otra dirección, incluida la raíz, se envía a /tareas: el
        guardián decide desde ahí si corresponde la pantalla o /login, con lo
        que la regla de "según haya sesión o no" vive en un solo sitio.
      */}
      <Route path="*" element={<Navigate to="/tareas" replace />} />
    </Routes>
  );
}
