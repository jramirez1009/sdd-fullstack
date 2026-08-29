import { useCallback, useEffect, useId, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header.jsx';
import { Sidebar } from './Sidebar.jsx';
import estilos from './Layout.module.css';

/**
 * Ruta de diseño: compone `Header` + `Sidebar` + `<Outlet />` alrededor del
 * contenido de cada pantalla autenticada. Al ser una layout route, `Header` y
 * `Sidebar` se montan una sola vez y no se re-montan al navegar entre secciones.
 *
 * El estado `panelAbierto` solo gobierna el panel superpuesto en pantalla
 * estrecha; en pantalla ancha el CSS del punto de corte hace que el `Sidebar`
 * fijo tome el relevo y el estado queda inerte.
 */
export function Layout() {
  const [panelAbierto, setPanelAbierto] = useState(false);
  const idPanel = useId();

  const cerrarPanel = useCallback(() => setPanelAbierto(false), []);
  const alternarPanel = useCallback(() => setPanelAbierto((abierto) => !abierto), []);

  useEffect(() => {
    if (!panelAbierto) {
      return undefined;
    }
    const alPulsarTecla = (evento) => {
      if (evento.key === 'Escape') {
        cerrarPanel();
      }
    };
    document.addEventListener('keydown', alPulsarTecla);
    return () => document.removeEventListener('keydown', alPulsarTecla);
  }, [panelAbierto, cerrarPanel]);

  return (
    <div className={estilos.armazon}>
      <Header
        panelAbierto={panelAbierto}
        alAlternarPanel={alternarPanel}
        idPanel={idPanel}
      />

      <div className={estilos.cuerpo}>
        {panelAbierto && (
          <div
            className={estilos.backdrop}
            role="presentation"
            onClick={cerrarPanel}
          />
        )}

        <div
          id={idPanel}
          className={panelAbierto ? `${estilos.sidebar} ${estilos.sidebarAbierto}` : estilos.sidebar}
        >
          <Sidebar alNavegar={cerrarPanel} />
        </div>

        <main className={estilos.contenido}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
