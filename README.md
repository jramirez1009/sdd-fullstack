# Lista de Tareas — aplicación full-stack

Reto técnico: aplicación web de gestión de tareas con autenticación, categorías,
etiquetas y filtrado avanzado. Entregable orientado a evaluación, con foco en
calidad de código, seguridad y aislamiento entre usuarios.

- **Backend:** Node.js + Express, PostgreSQL con SQL parametrizado directo
  (driver `pg`, sin ORM), autenticación JWT.
- **Frontend:** React (SPA con Vite), React Hooks + Context API, CSS Modules.
- **Base de datos:** PostgreSQL alojado en la nube (Supabase). **No hace falta
  instalar PostgreSQL en local.**

---

## 1. Estructura del repositorio

```
.
├── backend/            API REST (Express + pg)
│   ├── bd/             schema.sql, seed.sql y sus runners
│   └── src/
│       ├── config/         carga y validación de entorno, pool de conexiones
│       ├── controladores/  orquestan validación → repositorio → respuesta
│       ├── middleware/      autenticación, errores, logging, rate limiting
│       ├── repositorios/    ÚNICO lugar con SQL (siempre parametrizado)
│       ├── rutas/           definición de endpoints
│       └── utils/           jwt, password, validación, errores
├── frontend/           SPA de React
│   └── src/
│       ├── componentes/    Auth/ Tarea/ Categoria/ Layout/ Comunes/
│       ├── contexto/       ContextoAuth (estado de sesión)
│       ├── hooks/          useAuth, useTareas, useCategorias, useEtiquetas
│       └── servicios/      api.js (único punto que habla HTTP con la API)
├── docs/
│   └── api.md          documentación de todos los endpoints
└── openspec/           especificaciones vivas y historial de cambios
```

---

## 2. Requisitos previos

| Herramienta | Versión | Notas |
|---|---|---|
| Node.js | ≥ 20 | Se usa `node --watch` y ESM nativo |
| npm | ≥ 9 | Incluido con Node |
| PostgreSQL | — | **No se instala.** La base ya existe en Supabase; solo se necesita su cadena de conexión (`DATABASE_URL`) |

---

## 3. Puesta en marcha

Para levantar la aplicación en desarrollo se arrancan **dos procesos** en paralelo: la API y el servidor de desarrollo de Vite.

```bash
# 1) Clonar
git clone <url-del-repositorio>
cd fullstack

# 2) Backend
cd backend
cp .env.example .env          # y rellenar DATABASE_URL y JWT_SECRET (ver §4)
npm install
npm run dev                   # → http://localhost:3000

# 3) Frontend (en otra terminal, desde la raíz)
cd frontend
cp .env.example .env          # ajustar VITE_API_URL solo si la API no está en :3000
npm install
npm run dev                   # → http://localhost:5173
```

Abre `http://localhost:5173`, crea una cuenta desde **"Crear una cuenta"** y
empieza a gestionar tareas.

> En Windows PowerShell usa `Copy-Item .env.example .env` en lugar de `cp`.

---

## 4. Variables de entorno

Ningún `.env` se versiona. Cada paquete trae un `.env.example` con todas las
variables documentadas.

### Backend (`backend/.env`)

| Variable | Obligatoria | Por defecto | Descripción |
|---|---|---|---|
| `DATABASE_URL` | **Sí** | — | Cadena de conexión PostgreSQL (Supabase). Sin ella la API no arranca |
| `JWT_SECRET` | **Sí** | — | Secreto simétrico para firmar los JWT (HS256). Mínimo 32 caracteres o la API no arranca |
| `JWT_EXPIRACION` | No | `24h` | Duración del token (formato de `jsonwebtoken`: `24h`, `7d`, `3600`) |
| `PORT` | No | `3000` | Puerto de la API |
| `RATE_LIMIT_VENTANA_MS` | No | `60000` | Ventana del límite general |
| `RATE_LIMIT_MAX` | No | `100` | Máximo de peticiones por ventana e IP (límite general) |
| `RATE_LIMIT_LOGIN_VENTANA_MS` | No | `900000` | Ventana del límite reforzado de login |
| `RATE_LIMIT_LOGIN_MAX` | No | `10` | Máximo de intentos de login por ventana e IP |
| `LOG_FORMATO` | No | `legible` | `legible` (una línea por terminal) o `json` (para agregadores) |
| `LOG_NIVEL` | No | `info` | `info` (una entrada por petición) o `silencio` |
| `TRUST_PROXY` | No | `false` | `false`, `true` o el nº de proxies de confianza delante de la API |

Una variable presente con un valor inválido **detiene el arranque** con un
mensaje explicando qué corregir.

### Frontend (`frontend/.env`)

| Variable | Por defecto | Descripción |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3000` | URL base de la API. Vite solo expone al navegador las variables con prefijo `VITE_` |

---

## 5. Base de datos: esquema y datos de ejemplo

La base de Supabase se entrega **ya poblada**: el evaluador no necesita ejecutar
ningún script. `schema.sql` y `seed.sql` se incluyen en el repo como
documentación reproducible del esquema.

Los scripts son **idempotentes** (usan `IF NOT EXISTS` / `ON CONFLICT`), así que
reejecutarlos es inocuo. Se corren desde `backend/`:

```bash
npm run db:check     # comprueba que DATABASE_URL responde
npm run db:schema    # aplica bd/schema.sql (crea tablas, índices, disparadores)
npm run db:seed      # aplica bd/seed.sql (datos de ejemplo)
npm run db:setup     # schema + seed en un solo paso
```

Alternativa con `psql`:

```bash
psql "$DATABASE_URL" -f backend/bd/schema.sql
psql "$DATABASE_URL" -f backend/bd/seed.sql
```

### Modelo de datos

| Tabla | Propósito | Relaciones |
|---|---|---|
| `usuarios` | Cuentas. `email` único (CITEXT), `password_hash` (bcrypt) | — |
| `categorias` | Categorías por usuario. Únicas por `(usuario_id, nombre)` | `usuario_id` → `usuarios` (CASCADE) |
| `etiquetas` | Etiquetas por usuario. Únicas por `(usuario_id, nombre)` | `usuario_id` → `usuarios` (CASCADE) |
| `tareas` | Tareas. `estado`, `prioridad`, `fecha_vencimiento`, búsqueda por texto (`busqueda_tsv` generada) | `usuario_id` → `usuarios` (CASCADE), `categoria_id` → `categorias` (SET NULL) |
| `tarea_etiquetas` | Relación N:M tarea ↔ etiqueta | Clave compuesta `(tarea_id, etiqueta_id)`, ambas CASCADE |

Todos los índices llevan `usuario_id` como primera columna: ninguna consulta
cruza la frontera de un usuario.

---

## 6. Documentación de la API

Todos los endpoints, con ejemplos de request/response y códigos de estado, en
[`docs/api.md`](docs/api.md).

Resumen:

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/api/auth/registro` | — | Crear cuenta |
| POST | `/api/auth/login` | — | Iniciar sesión (devuelve JWT) |
| GET | `/api/auth/perfil` | ✔ | Datos del usuario autenticado |
| GET | `/api/categorias` | ✔ | Listar categorías |
| POST | `/api/categorias` | ✔ | Crear categoría |
| PUT | `/api/categorias/:id` | ✔ | Renombrar categoría |
| DELETE | `/api/categorias/:id` | ✔ | Eliminar categoría |
| GET | `/api/etiquetas` | ✔ | Listar etiquetas |
| POST | `/api/etiquetas` | ✔ | Crear etiqueta |
| PUT | `/api/etiquetas/:id` | ✔ | Renombrar etiqueta |
| DELETE | `/api/etiquetas/:id` | ✔ | Eliminar etiqueta |
| GET | `/api/tareas` | ✔ | Listar tareas (con filtros, búsqueda y orden) |
| POST | `/api/tareas` | ✔ | Crear tarea |
| PUT | `/api/tareas/:id` | ✔ | Editar tarea |
| PATCH | `/api/tareas/:id/completar` | ✔ | Marcar completada / pendiente |
| DELETE | `/api/tareas/:id` | ✔ | Eliminar tarea |

---

## 7. Scripts npm

### Backend (`backend/`)

| Script | Acción |
|---|---|
| `npm run dev` | API con recarga automática (`node --watch`) |
| `npm start` | API en modo producción |
| `npm run db:check` | Comprueba la conexión a la base |
| `npm run db:schema` | Aplica `bd/schema.sql` |
| `npm run db:seed` | Aplica `bd/seed.sql` |
| `npm run db:setup` | `db:schema` + `db:seed` |

### Frontend (`frontend/`)

| Script | Acción |
|---|---|
| `npm run dev` | Servidor de desarrollo de Vite |
| `npm run build` | Compilación de producción a `dist/` |
| `npm run preview` | Sirve el `build` para revisión |

---

## 8. Seguridad

- **Autenticación JWT** verificada en un único middleware; todo router de datos
  se monta detrás de él.
- **Aislamiento entre usuarios:** el `usuario_id` sale siempre del token, nunca
  de un parámetro del cliente. Toda consulta —lectura y escritura— filtra por
  `usuario_id`. Un recurso ajeno responde 404, indistinguible de "no existe".
- **SQL siempre parametrizado.** El SQL vive solo en `repositorios/`; los
  identificadores de columna del `ORDER BY` salen de listas blancas.
- **Rate limiting** general + uno reforzado sobre `/api/auth/login`.
- **Validación de entrada** en cada petición antes de tocar la base.
- Los errores nunca filtran trazas de pila ni mensajes del driver al cliente.

---

## 9. Flujo de desarrollo (OpenSpec)

El comportamiento observable del sistema se especifica en `openspec/specs/`.
Cada cambio funcional entró como una *change* de OpenSpec (propuesta + deltas +
tareas) y se archivó al completarse. El historial de `git log --oneline` refleja
ese ciclo con Conventional Commits en español.
