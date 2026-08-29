import { useState } from 'react';
import { Cargando } from '../Comunes/Cargando.jsx';
import { MensajeError } from '../Comunes/MensajeError.jsx';
import { useCategorias } from '../../hooks/useCategorias.js';
import { FormularioCategoria } from './FormularioCategoria.jsx';
import { DialogoConfirmarBorrado } from './DialogoConfirmarBorrado.jsx';
import { ErrorApi } from '../../servicios/api.js';
import estilos from './ListaCategorias.module.css';

/**
 * Pantalla de gestión de categorías. Consume `useCategorias()` y decide qué
 * pintar según el sub-estado (cargando / error de carga / lista vacía / lista
 * con datos), y orquesta el formulario de crear-editar y el diálogo de borrado.
 *
 * Tras una acción exitosa la lista ya viene reconciliada por el hook (que la
 * vuelve a pedir), de modo que el alta, el renombrado y el borrado se reflejan
 * de inmediato sin recargar la página.
 */
export function ListaCategorias() {
  const { categorias, cargando, error, recargar, crear, editar, eliminar } = useCategorias();

  // null | { modo: 'crear' } | { modo: 'editar', categoria }
  const [formulario, setFormulario] = useState(null);
  // null | categoria
  const [aEliminar, setAEliminar] = useState(null);

  const mensajeErrorCarga = error instanceof ErrorApi
    ? error.mensaje
    : 'No se han podido cargar las categorías.';

  return (
    <section className={estilos.pantalla}>
      <header className={estilos.cabecera}>
        <h1 className={estilos.titulo}>Categorías</h1>
        {!cargando && !error && (
          <button
            className={estilos.botonPrimario}
            type="button"
            onClick={() => setFormulario({ modo: 'crear' })}
          >
            Nueva categoría
          </button>
        )}
      </header>

      {cargando && <Cargando texto="Cargando categorías…" />}

      {!cargando && error && (
        <div className={estilos.zonaEstado}>
          <MensajeError>{mensajeErrorCarga}</MensajeError>
          <button className={estilos.botonSecundario} type="button" onClick={recargar}>
            Reintentar
          </button>
        </div>
      )}

      {!cargando && !error && categorias.length === 0 && (
        <div className={estilos.vacio}>
          <p>Aún no tienes categorías.</p>
          <button
            className={estilos.botonPrimario}
            type="button"
            onClick={() => setFormulario({ modo: 'crear' })}
          >
            Crear la primera
          </button>
        </div>
      )}

      {!cargando && !error && categorias.length > 0 && (
        <ul className={estilos.lista}>
          {categorias.map((categoria) => (
            <li key={categoria.id} className={estilos.fila}>
              <span className={estilos.nombre}>{categoria.nombre}</span>
              <div className={estilos.accionesFila}>
                <button
                  className={estilos.botonSecundario}
                  type="button"
                  onClick={() => setFormulario({ modo: 'editar', categoria })}
                >
                  Editar
                </button>
                <button
                  className={estilos.botonSecundario}
                  type="button"
                  onClick={() => setAEliminar(categoria)}
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {formulario && (
        <div className={estilos.zonaFormulario}>
          <FormularioCategoria
            categoria={formulario.modo === 'editar' ? formulario.categoria : null}
            alCrear={crear}
            alEditar={editar}
            alGuardar={() => setFormulario(null)}
            alCancelar={() => setFormulario(null)}
          />
        </div>
      )}

      {aEliminar && (
        <DialogoConfirmarBorrado
          categoria={aEliminar}
          alConfirmar={async (id) => {
            await eliminar(id);
            setAEliminar(null);
          }}
          alCancelar={() => setAEliminar(null)}
        />
      )}
    </section>
  );
}
