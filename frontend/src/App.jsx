import { Navigate, Route, Routes } from 'react-router-dom';
import { RutaProtegida, RutaSoloAnonima } from './componentes/Comunes/RutaProtegida.jsx';
import { FormularioLogin } from './componentes/Auth/FormularioLogin.jsx';
import { FormularioRegistro } from './componentes/Auth/FormularioRegistro.jsx';
import { Tareas } from './paginas/Tareas.jsx';

export function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={(
          <RutaSoloAnonima>
            <FormularioLogin />
          </RutaSoloAnonima>
        )}
      />
      <Route
        path="/registro"
        element={(
          <RutaSoloAnonima>
            <FormularioRegistro />
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
