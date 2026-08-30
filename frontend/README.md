# Interfaz web — Lista de Tareas

SPA de React con Vite. Consume la API del backend; no incluye lógica de negocio
propia más allá de la validación inmediata de los formularios.

## Puesta en marcha

Para levantar la aplicación en desarrollo se arrancan **dos procesos** en paralelo: el backend y el servidor de desarrollo de Vite.

```bash
# 1) Backend, en la raíz del repositorio
cd backend && npm install && npm run dev      # http://localhost:3000

# 2) Frontend, en otra terminal
cd frontend && npm install && npm run dev     # http://localhost:5173
```

## Configuración

Copia `.env.example` a `.env` y ajusta la URL de la API si el backend no corre
en `http://localhost:3000`:

```
VITE_API_URL=http://localhost:3000
```

Vite solo expone al navegador las variables cuyo nombre empieza por `VITE_`.

## Estructura

```
src/
  main.jsx                      # montaje, router, proveedor de sesión y Error Boundary
  App.jsx                       # rutas
  servicios/api.js              # único punto que habla HTTP con la API
  servicios/validacion.js       # validación inmediata de los formularios
  contexto/ContextoAuth.jsx     # estado de sesión (singular, según el árbol del reto)
  hooks/                        # useAuth, useTareas, useCategorias, useEtiquetas
  componentes/Auth/             # FormularioLogin, FormularioRegistro
  componentes/Tarea/            # ListaTareas, ItemTarea, FormularioTarea, FiltroTareas
  componentes/Categoria/        # ListaCategorias, FormularioCategoria
  componentes/Layout/           # Header, Sidebar, Layout
  componentes/Comunes/          # Cargando, MensajeError, LimiteDeError, RutaProtegida
  estilos/                      # reset y variables globales
```

La documentación de la API que consume esta SPA está en
[`../docs/api.md`](../docs/api.md).

Estilos con CSS Modules: cada componente lleva su `.module.css` al lado, y las
piezas compartidas por los dos formularios viven en
`estilos/formulario.module.css`, compuestas con `composes`.
