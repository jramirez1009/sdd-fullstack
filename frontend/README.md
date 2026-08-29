# Interfaz web — Lista de Tareas

SPA de React con Vite. Consume la API del backend; no incluye lógica de negocio
propia más allá de la validación inmediata de los formularios.

## Puesta en marcha

Hacen falta **dos procesos**: el backend y el servidor de desarrollo de Vite.

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
  main.jsx                     # montaje, router y proveedor de sesión
  App.jsx                      # rutas
  servicios/api.js             # único punto que habla HTTP con la API
  servicios/validacion.js      # validación inmediata de los formularios
  contextos/ContextoAuth.jsx   # estado de sesión
  hooks/useAuth.js             # única vía de acceso a la sesión
  paginas/                     # Login, Registro, Tareas
  componentes/Comunes/         # Cargando, MensajeError, RutaProtegida
  estilos/                     # reset y variables globales
```

Estilos con CSS Modules: cada componente lleva su `.module.css` al lado, y las
piezas compartidas por los dos formularios viven en
`estilos/formulario.module.css`, compuestas con `composes`.
