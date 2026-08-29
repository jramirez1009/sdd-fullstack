## Context

Ver `proposal.md` — Why para la motivación, y `specs/frontend-autenticacion/spec.md` para
el requisito nuevo.

Estado actual del frontend (implementado por `add-frontend-autenticacion`):

```
frontend/src/
  App.jsx                         # importa desde paginas/
  main.jsx                        # importa ProveedorAuth desde contextos/
  contextos/ContextoAuth.jsx      # exporta ProveedorAuth, ContextoAuth, MOTIVO_CIERRE
  hooks/useAuth.js                # importa ContextoAuth desde ../contextos/
  paginas/Login.jsx  Login.module.css
  paginas/Registro.jsx  Registro.module.css
  paginas/Tareas.jsx  Tareas.module.css      # NO se toca en este cambio
  componentes/Comunes/…           # ya correcto
  servicios/  estilos/            # ya correctos
```

`design.md` § 8 de `add-frontend-autenticacion` describió esta estructura, pero se apartó
del árbol del reto (que pide `componentes/Auth/FormularioLogin.jsx`,
`componentes/Auth/FormularioRegistro.jsx` y `contexto/` en singular). La spec de
comportamiento no fijaba nombres de archivo, así que la desviación pasó la verificación.

Restricción que domina el cambio: **no puede cambiar ningún comportamiento observable**.
La verificación es que login, registro, errores y persistencia de sesión funcionan
exactamente igual antes y después.

## Goals / Non-Goals

**Goals:**

- Mover y renombrar los archivos de autenticación para que coincidan literalmente con el
  árbol del reto.
- Actualizar todos los imports afectados en un solo paso, sin dejar rutas rotas.
- Dejar registrada en `openspec/config.yaml` la regla que impide que la desviación se
  repita en `add-frontend-tareas`, `add-frontend-shell` y siguientes.

**Non-Goals:**

- Tocar `paginas/Tareas.jsx` o su `.module.css` (los reubica `add-frontend-tareas` al
  reconstruir la pantalla).
- Cambiar la lógica interna de `ContextoAuth.jsx`, `useAuth.js`, `api.js` o los
  formularios: solo cambian rutas de import y, en los formularios, la profundidad relativa
  (`../` → `../../`).
- Introducir `hooks/`, `servicios/`, `utils/` nuevos: ya existen o no aplican aquí.
- Renombrar los símbolos exportados (`Login`, `Registro`): ver Decisión 2.

## Decisions

### 1. Mover archivos y reescribir imports, no crear reexportadores

Los cuatro archivos de `paginas/` (dos `.jsx` + dos `.module.css`) se mueven a
`componentes/Auth/` con el nuevo nombre; `contextos/ContextoAuth.jsx` se mueve a
`contexto/ContextoAuth.jsx`. Se actualizan los imports en cada archivo consumidor.

**Alternativa descartada**: dejar archivos puente en las ubicaciones viejas que
reexporten desde las nuevas. Mantendría dos rutas para lo mismo, que es justo lo que el
reto penaliza al evaluar estructura, y dejaría `paginas/` con contenido de auth en contra
del requisito nuevo.

**Imports a reescribir:**

| Archivo | Cambio |
| --- | --- |
| `App.jsx` | `./paginas/Login.jsx` → `./componentes/Auth/FormularioLogin.jsx`; ídem Registro; símbolos `Login`/`Registro` → `FormularioLogin`/`FormularioRegistro` |
| `main.jsx` | `./contextos/ContextoAuth.jsx` → `./contexto/ContextoAuth.jsx` |
| `hooks/useAuth.js` | `../contextos/ContextoAuth.jsx` → `../contexto/ContextoAuth.jsx` |
| `componentes/Auth/FormularioLogin.jsx` | `../componentes/Comunes/…` → `../Comunes/…`; `../contextos/ContextoAuth.jsx` → `../../contexto/ContextoAuth.jsx`; `../hooks/…` → `../../hooks/…`; `../servicios/…` → `../../servicios/…`; `./Login.module.css` → `./FormularioLogin.module.css` |
| `componentes/Auth/FormularioRegistro.jsx` | equivalente, con `./FormularioRegistro.module.css` |

`componentes/Comunes/RutaProtegida.jsx` y demás no cambian: ya están en su sitio.

### 2. Renombrar los componentes de `Login`/`Registro` a `FormularioLogin`/`FormularioRegistro`

El archivo se llama `FormularioLogin.jsx`; el componente exportado se llama igual, por
coherencia y porque el árbol del reto nombra la pieza así. Es un renombrado mecánico
(declaración + import en `App.jsx`). No afecta a rutas ni a comportamiento.

**Alternativa descartada**: conservar `export function Login` dentro de
`FormularioLogin.jsx`. Funcionaría, pero deja un desajuste nombre-archivo que confunde al
revisar.

### 3. La regla anti-recurrencia va en `openspec/config.yaml`, artefacto `design`

Se añade a `rules.design` una entrada que obliga a que todo `design.md` de frontend
declare la ubicación de cada pieza según el árbol del reto (`componentes/<Recurso>/`,
`hooks/`, `servicios/`, `contexto/`, `utils/`) de forma literal. Se elige el artefacto
`design` porque es donde `add-frontend-autenticacion` fijó (y desvió) la estructura en su
§ 8; interceptarlo ahí obliga a que la siguiente propuesta lo haga bien antes de escribir
código.

**Alternativa descartada**: ponerlo solo en `design.md` de este cambio. No se propagaría
a las propuestas siguientes, que es el objetivo (el patrón ya reapareció en
`paginas/Tareas.jsx`).

**Nota sobre `config.yaml`**: hoy define reglas para claves de artefacto `api`,
`frontend` y `entrega` que la CLI reporta como desconocidas (warnings al pedir
instrucciones). No se corrige aquí para no ampliar el alcance; la entrada nueva sí va bajo
la clave válida `design`.

### 4. Verificación: arranque de Vite + recorrido manual

Sin tests automatizados de interfaz (igual que `add-frontend-autenticacion`). La
verificación es: `npm run build` sin errores de resolución de módulos, y el recorrido
manual de `tasks.md` (registro, login, error de credenciales, recarga con sesión, cierre
de sesión) con el backend en el puerto 3000.

## Risks / Trade-offs

- **Un import olvidado deja la app sin compilar** → `npm run build` (o el arranque de
  Vite) falla de inmediato con la ruta exacta; la tabla de la Decisión 1 enumera todos.
- **`git` pierde el historial si el move no se detecta como rename** → Los archivos se
  mueven con cambios mínimos (solo imports), así que `git` los detecta como rename. Aun
  si no lo hiciera, el historial es recuperable y no bloquea la entrega.
- **Colisión con trabajo en curso sobre `paginas/`** → No hay: `add-frontend-tareas` aún
  no ha empezado y este cambio no toca `Tareas.jsx`.
- **La regla nueva de `config.yaml` endurece las propuestas futuras** → Es el efecto
  buscado; el coste es una frase más de estructura en cada `design.md` de frontend.

## Migration Plan

No hay migración de datos ni de API. Pasos:

1. Crear `frontend/src/componentes/Auth/` y `frontend/src/contexto/`.
2. Mover y renombrar los cinco archivos (`git mv`).
3. Reescribir los imports según la tabla de la Decisión 1.
4. Borrar `frontend/src/contextos/` y `frontend/src/paginas/Login*.` / `Registro*` ;
   dejar `frontend/src/paginas/` si `Tareas*` sigue ahí (lo está).
5. `npm run build` y recorrido manual.
6. Añadir la regla a `openspec/config.yaml`.

**Rollback**: `git revert` del commit. Nada de lo entregado depende de las rutas nuevas
fuera del propio frontend.
