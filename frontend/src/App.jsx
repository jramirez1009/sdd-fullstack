import { Navigate, Route, Routes } from 'react-router-dom';
import { RutaProtegida, RutaSoloAnonima } from './componentes/Comunes/RutaProtegida.jsx';
import { FormularioLogin } from './componentes/Auth/FormularioLogin.jsx';
import { FormularioRegistro } from './componentes/Auth/FormularioRegistro.jsx';
import { Layout } from './componentes/Layout/Layout.jsx';
import { Tareas } from './paginas/Tareas.jsx';

export function App() {
  return (
    <Routes>
      {/*
        Ruta de diseño: `RutaProtegida` comprueba la sesión una sola vez y, si
        procede, monta `Layout`. Las pantallas autenticadas son rutas hijas que
        se pintan en el `<Outlet />` del Layout, sin repetir el armazón ni el
        guardián.
      */}
      <Route
        element={(
          <RutaProtegida>
            <Layout />
          </RutaProtegida>
        )}
      >
        <Route path="/tareas" element={<Tareas />} />
        {/* categorías, etiquetas… en cambios posteriores */}
      </Route>

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
      {/*
        Cualquier otra dirección, incluida la raíz, se envía a /tareas: el
        guardián decide desde ahí si corresponde la pantalla o /login, con lo
        que la regla de "según haya sesión o no" vive en un solo sitio.
      */}
      <Route path="*" element={<Navigate to="/tareas" replace />} />
    </Routes>
  );
}
