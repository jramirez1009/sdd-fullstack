# Documentación de la API — Lista de Tareas

Base URL en desarrollo: `http://localhost:3000`
Todas las rutas cuelgan de `/api`.

- [Convenciones generales](#convenciones-generales)
- [Autenticación](#autenticación)
- [Formato de errores](#formato-de-errores)
- [Endpoints de autenticación](#endpoints-de-autenticación)
- [Endpoints de categorías](#endpoints-de-categorías)
- [Endpoints de etiquetas](#endpoints-de-etiquetas)
- [Endpoints de tareas](#endpoints-de-tareas)
- [Objeto `tarea`](#objeto-tarea)
- [Reglas de validación](#reglas-de-validación)

---

## Convenciones generales

- El cuerpo de las peticiones y respuestas es **JSON** (`Content-Type: application/json`).
- Los **identificadores viajan como cadena**, no como número: son `BIGINT` y su
  valor puede exceder la precisión de un número en JSON.
- Los **instantes** (`creado_en`, `actualizado_en`, `completada_en`,
  `ultimo_login`) son ISO 8601 en UTC con `Z` (`2026-08-30T09:15:04.123Z`).
- `fecha_vencimiento` es una **fecha sin hora**: `AAAA-MM-DD`.
- No existe endpoint de *logout*: el cliente descarta el token.
- No existe endpoint de *health-check*. Cualquier ruta no definida responde
  `404 NO_ENCONTRADO` con el formato de error estándar.
- Un cuerpo con JSON mal formado responde `400 DATOS_INVALIDOS` con el mensaje
  «El cuerpo de la petición no es JSON válido.».

### Códigos de estado usados

| Código | Cuándo |
|---|---|
| `200 OK` | Lectura o actualización correcta |
| `201 Created` | Recurso creado |
| `204 No Content` | Borrado correcto (sin cuerpo) |
| `400 Bad Request` | Entrada inválida (`DATOS_INVALIDOS`) o referencia inválida (`REFERENCIA_INVALIDA`) |
| `401 Unauthorized` | Falta el token, es inválido/expirado (`NO_AUTENTICADO`), o credenciales incorrectas (`CREDENCIALES_INVALIDAS`) |
| `404 Not Found` | El recurso no existe **o pertenece a otro usuario** (`NO_ENCONTRADO`) |
| `409 Conflict` | Email ya registrado (`EMAIL_DUPLICADO`) o nombre repetido (`NOMBRE_DUPLICADO`) |
| `429 Too Many Requests` | Límite de peticiones superado (`DEMASIADAS_PETICIONES`) |
| `500 Internal Server Error` | Fallo no previsto (`ERROR_INTERNO`) — sin detalles técnicos en la respuesta |

---

## Autenticación

Las rutas marcadas con 🔒 requieren un JWT válido en la cabecera:

```
Authorization: Bearer <token>
```

El token se obtiene en `POST /api/auth/login` y contiene el `id` y el `email`
del usuario. Su duración por defecto es de 24 horas (`JWT_EXPIRACION`).

Ante cualquier fallo de autenticación (sin cabecera, cabecera mal formada, firma
inválida, token expirado, o usuario ya inexistente) la respuesta es
`401 NO_AUTENTICADO`; el motivo exacto no se detalla.

### Rate limiting

Todas las respuestas incluyen:

| Cabecera | Significado |
|---|---|
| `RateLimit-Limit` | Máximo de peticiones en la ventana |
| `RateLimit-Remaining` | Peticiones restantes |
| `RateLimit-Reset` | Segundos hasta que se reinicia el contador |
| `Retry-After` | (solo en `429`) segundos que hay que esperar |

Hay dos límites independientes por IP:

- **General** (toda la API): 100 peticiones / 60 s por defecto.
- **Reforzado** (`POST /api/auth/login`): 10 intentos / 15 min por defecto,
  además del general.

---

## Formato de errores

Todos los errores comparten la misma forma:

```json
{
  "error": {
    "codigo": "DATOS_INVALIDOS",
    "mensaje": "Los datos enviados no son válidos.",
    "detalles": {
      "email": "El email no tiene un formato válido."
    }
  }
}
```

- `codigo`: cadena estable. **El cliente decide su comportamiento por el código,
  nunca por el texto de `mensaje`.**
- `detalles`: opcional. En `DATOS_INVALIDOS` es un mapa `campo → motivo`. En
  `NOMBRE_DUPLICADO` y `REFERENCIA_INVALIDA` es `{ "recurso": "categoria" | "etiqueta" | "etiquetas" }`.

| `codigo` | Estado HTTP |
|---|---|
| `DATOS_INVALIDOS` | 400 |
| `REFERENCIA_INVALIDA` | 400 |
| `NO_AUTENTICADO` | 401 |
| `CREDENCIALES_INVALIDAS` | 401 |
| `NO_ENCONTRADO` | 404 |
| `EMAIL_DUPLICADO` | 409 |
| `NOMBRE_DUPLICADO` | 409 |
| `DEMASIADAS_PETICIONES` | 429 |
| `ERROR_INTERNO` | 500 |

---

## Endpoints de autenticación

### POST /api/auth/registro

Crea una cuenta. No devuelve token: para obtenerlo hay que llamar a `login`.

**Request**

```json
{
  "email": "ana@example.com",
  "password": "una-contraseña-larga",
  "nombre": "Ana"
}
```

| Campo | Tipo | Obligatorio | Reglas |
|---|---|---|---|
| `email` | string | sí | Formato válido, ≤ 254 caracteres. Se compara sin distinguir mayúsculas |
| `password` | string | sí | Entre 8 y 72 bytes UTF-8 |
| `nombre` | string | no | Si se envía, 1–100 caracteres (no cadena vacía) |

**Response `201 Created`**

```json
{
  "id": "1",
  "email": "ana@example.com",
  "nombre": "Ana"
}
```

**Errores**

| Estado | `codigo` | Caso |
|---|---|---|
| 400 | `DATOS_INVALIDOS` | Email mal formado, contraseña corta/larga, `nombre` vacío |
| 409 | `EMAIL_DUPLICADO` | Ya existe una cuenta con ese email |
| 429 | `DEMASIADAS_PETICIONES` | Límite general superado |

```bash
curl -X POST http://localhost:3000/api/auth/registro \
  -H 'Content-Type: application/json' \
  -d '{"email":"ana@example.com","password":"una-contraseña-larga","nombre":"Ana"}'
```

---

### POST /api/auth/login

Valida las credenciales y devuelve el JWT. Registra además el instante como
último inicio de sesión del usuario.

**Request**

```json
{
  "email": "ana@example.com",
  "password": "una-contraseña-larga"
}
```

**Response `200 OK`**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "usuario": {
    "id": "1",
    "email": "ana@example.com",
    "nombre": "Ana"
  }
}
```

**Errores**

| Estado | `codigo` | Caso |
|---|---|---|
| 400 | `DATOS_INVALIDOS` | Falta `email` o `password` |
| 401 | `CREDENCIALES_INVALIDAS` | Email inexistente **o** contraseña incorrecta (misma respuesta: no se revela si el email existe) |
| 429 | `DEMASIADAS_PETICIONES` | Límite reforzado de login superado |

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ana@example.com","password":"una-contraseña-larga"}'
```

---

### GET /api/auth/perfil 🔒

Datos públicos del usuario autenticado.

**Response `200 OK`**

```json
{
  "id": "1",
  "email": "ana@example.com",
  "nombre": "Ana",
  "creado_en": "2026-08-28T12:00:00.000Z",
  "ultimo_login": "2026-08-30T09:15:04.123Z"
}
```

`ultimo_login` es `null` mientras el usuario nunca haya iniciado sesión con éxito.

**Errores**

| Estado | `codigo` | Caso |
|---|---|---|
| 401 | `NO_AUTENTICADO` | Token ausente, inválido, expirado, o el usuario del token ya no existe |

```bash
curl http://localhost:3000/api/auth/perfil \
  -H "Authorization: Bearer $TOKEN"
```

---

## Endpoints de categorías

Todas 🔒. Una categoría solo es visible y modificable por su dueño.

### GET /api/categorias 🔒

Devuelve todas las categorías del usuario, ordenadas por nombre.

**Response `200 OK`**

```json
[
  { "id": "3", "nombre": "Personal", "creado_en": "2026-08-28T12:05:00.000Z" },
  { "id": "1", "nombre": "Trabajo",  "creado_en": "2026-08-28T12:04:00.000Z" }
]
```

---

### POST /api/categorias 🔒

**Request**

```json
{ "nombre": "Trabajo" }
```

| Campo | Tipo | Reglas |
|---|---|---|
| `nombre` | string | Obligatorio, 1–100 caracteres, sin saltos de línea ni caracteres de control. Se normaliza a Unicode NFC |

**Response `201 Created`**

```json
{ "id": "1", "nombre": "Trabajo", "creado_en": "2026-08-28T12:04:00.000Z" }
```

**Errores**

| Estado | `codigo` | Caso |
|---|---|---|
| 400 | `DATOS_INVALIDOS` | `nombre` ausente, vacío, demasiado largo o con caracteres de control |
| 409 | `NOMBRE_DUPLICADO` | Ya tienes una categoría con ese nombre. `detalles.recurso = "categoria"` |

```bash
curl -X POST http://localhost:3000/api/categorias \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"nombre":"Trabajo"}'
```

---

### PUT /api/categorias/:id 🔒

Renombra una categoría. Mismo cuerpo y validación que `POST`.

**Response `200 OK`** — la categoría actualizada.

**Errores**

| Estado | `codigo` | Caso |
|---|---|---|
| 400 | `DATOS_INVALIDOS` | `id` no numérico, o `nombre` inválido |
| 404 | `NO_ENCONTRADO` | No existe o es de otro usuario |
| 409 | `NOMBRE_DUPLICADO` | Otra categoría tuya ya usa ese nombre |

---

### DELETE /api/categorias/:id 🔒

Elimina una categoría. Las tareas que la tenían asignada quedan **sin categoría**
(`categoria_id` pasa a `NULL`), no se borran.

**Response `204 No Content`** (sin cuerpo).

**Errores**

| Estado | `codigo` | Caso |
|---|---|---|
| 400 | `DATOS_INVALIDOS` | `id` no numérico |
| 404 | `NO_ENCONTRADO` | No existe o es de otro usuario |

---

## Endpoints de etiquetas

Todas 🔒. Misma semántica de propiedad que las categorías.

### GET /api/etiquetas 🔒

**Response `200 OK`**

```json
[
  { "id": "5", "nombre": "casa",    "creado_en": "2026-08-28T12:06:00.000Z" },
  { "id": "8", "nombre": "urgente", "creado_en": "2026-08-28T12:07:00.000Z" }
]
```

---

### POST /api/etiquetas 🔒

**Request**

```json
{ "nombre": "urgente" }
```

| Campo | Tipo | Reglas |
|---|---|---|
| `nombre` | string | Obligatorio, 1–50 caracteres, sin caracteres de control. Se normaliza a NFC |

**Response `201 Created`**

```json
{ "id": "8", "nombre": "urgente", "creado_en": "2026-08-28T12:07:00.000Z" }
```

**Errores**

| Estado | `codigo` | Caso |
|---|---|---|
| 400 | `DATOS_INVALIDOS` | `nombre` ausente, vacío o demasiado largo |
| 409 | `NOMBRE_DUPLICADO` | Ya tienes una etiqueta con ese nombre. `detalles.recurso = "etiqueta"` |

---

### PUT /api/etiquetas/:id 🔒

Renombra una etiqueta. Mismo cuerpo y validación que `POST`.

**Response `200 OK`** — la etiqueta actualizada.
**Errores:** `400 DATOS_INVALIDOS`, `404 NO_ENCONTRADO`, `409 NOMBRE_DUPLICADO`.

---

### DELETE /api/etiquetas/:id 🔒

Elimina la etiqueta y todos sus vínculos con tareas (las tareas no se borran).

**Response `204 No Content`**.
**Errores:** `400 DATOS_INVALIDOS`, `404 NO_ENCONTRADO`.

---

## Endpoints de tareas

Todas 🔒.

### GET /api/tareas 🔒

Devuelve las tareas del usuario que cumplen **todos** los filtros indicados (se
combinan con `AND`). Sin filtros, devuelve todas.

**Parámetros de query** (todos opcionales)

| Parámetro | Valores | Efecto |
|---|---|---|
| `completada` | `true` \| `false` | Filtra por estado de completada |
| `categoria` | id (`"3"`) \| `ninguna` | Tareas de esa categoría, o sin categoría con `ninguna` |
| `prioridad` | `baja` \| `media` \| `alta` | Filtra por prioridad |
| `fecha_vencimiento_desde` | `AAAA-MM-DD` | Vencen en o después de esa fecha |
| `fecha_vencimiento_hasta` | `AAAA-MM-DD` | Vencen en o antes de esa fecha |
| `busqueda` | texto libre | Búsqueda en título y descripción (lematizada, insensible a acentos y mayúsculas). Vacía = se ignora |
| `etiquetas` | nombre, repetible | `?etiquetas=casa&etiquetas=urgente` → tareas que tienen **todas** esas etiquetas |
| `ordenar` | `creado_en` \| `fecha_vencimiento` \| `prioridad` \| `titulo` | Campo de ordenación (por defecto `creado_en`) |
| `direccion` | `asc` \| `desc` | Dirección. Por defecto, la propia del campo: `creado_en`→`desc`, `fecha_vencimiento`→`asc`, `prioridad`→`desc`, `titulo`→`asc` |

Un valor no admitido devuelve `400 DATOS_INVALIDOS` con el detalle en el
parámetro correspondiente (no se ignora en silencio). Un parámetro repetido que
no sea `etiquetas` también es `400`.

**Response `200 OK`** — array de [objetos `tarea`](#objeto-tarea):

```json
[
  {
    "id": "12",
    "titulo": "Preparar informe trimestral",
    "descripcion": "Incluir métricas de soporte",
    "prioridad": "alta",
    "fecha_vencimiento": "2026-09-05",
    "completada": false,
    "creado_en": "2026-08-30T08:00:00.000Z",
    "actualizado_en": "2026-08-30T08:00:00.000Z",
    "completada_en": null,
    "categoria": { "id": "1", "nombre": "Trabajo", "creado_en": "2026-08-28T12:04:00.000Z" },
    "etiquetas": [
      { "id": "8", "nombre": "urgente", "creado_en": "2026-08-28T12:07:00.000Z" }
    ]
  }
]
```

```bash
curl "http://localhost:3000/api/tareas?completada=false&prioridad=alta&ordenar=fecha_vencimiento&direccion=asc&etiquetas=urgente" \
  -H "Authorization: Bearer $TOKEN"
```

---

### POST /api/tareas 🔒

**Request**

```json
{
  "titulo": "Preparar informe trimestral",
  "descripcion": "Incluir métricas de soporte",
  "prioridad": "alta",
  "fecha_vencimiento": "2026-09-05",
  "categoria_id": "1",
  "etiquetas": ["8", "5"]
}
```

| Campo | Tipo | Obligatorio | Reglas |
|---|---|---|---|
| `titulo` | string | sí | 1–200 caracteres, sin saltos de línea ni caracteres de control |
| `descripcion` | string \| null | no | ≤ 2000 caracteres; se permiten saltos de línea. Vacío se guarda como `null` |
| `prioridad` | `baja`\|`media`\|`alta` | no | Por defecto `media` |
| `fecha_vencimiento` | `AAAA-MM-DD` \| null | no | Debe ser un día real del calendario |
| `categoria_id` | string \| null | no | Debe ser una categoría **del usuario** |
| `etiquetas` | string[] | no | IDs de etiquetas **del usuario**. Máximo 50. Duplicados se colapsan |

Los campos no reconocidos (`usuario_id`, `estado`, `completada`, `creado_en`…)
se ignoran.

**Response `201 Created`** — el objeto `tarea` completo (con `categoria` y
`etiquetas` embebidas).

**Errores**

| Estado | `codigo` | Caso |
|---|---|---|
| 400 | `DATOS_INVALIDOS` | Cualquier campo inválido (detalle por campo) |
| 400 | `REFERENCIA_INVALIDA` | `categoria_id` o alguna etiqueta no existe o es de otro usuario. `detalles.recurso = "categoria"` \| `"etiquetas"` |

```bash
curl -X POST http://localhost:3000/api/tareas \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"titulo":"Preparar informe","prioridad":"alta","categoria_id":"1","etiquetas":["8"]}'
```

---

### PUT /api/tareas/:id 🔒

Sustituye el contenido de una tarea. Mismo cuerpo y validación que `POST`, con
una diferencia en `etiquetas`:

- **`etiquetas` ausente** → se conservan las etiquetas actuales.
- **`etiquetas: []`** → se quitan todas.
- **`etiquetas: ["8"]`** → el conjunto pasa a ser exactamente ese.

No cambia el dueño ni el estado de completada (para eso está `PATCH .../completar`).

**Response `200 OK`** — la tarea actualizada.

**Errores**

| Estado | `codigo` | Caso |
|---|---|---|
| 400 | `DATOS_INVALIDOS` | `id` no numérico o campo inválido |
| 400 | `REFERENCIA_INVALIDA` | Categoría o etiqueta ajena/inexistente |
| 404 | `NO_ENCONTRADO` | La tarea no existe o es de otro usuario |

---

### PATCH /api/tareas/:id/completar 🔒

Fija el estado de completada. Idempotente: repetir la misma llamada deja el mismo
estado.

**Request**

```json
{ "completada": true }
```

| Campo | Tipo | Reglas |
|---|---|---|
| `completada` | boolean | Obligatorio. Se exige booleano estricto: `"true"` o `1` se rechazan |

Al marcar `true` se fija `completada_en` al instante actual; al marcar `false` se
pone a `null`.

**Response `200 OK`** — la tarea actualizada.

**Errores**

| Estado | `codigo` | Caso |
|---|---|---|
| 400 | `DATOS_INVALIDOS` | `id` no numérico o `completada` ausente/no booleano |
| 404 | `NO_ENCONTRADO` | La tarea no existe o es de otro usuario |

```bash
curl -X PATCH http://localhost:3000/api/tareas/12/completar \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"completada":true}'
```

---

### DELETE /api/tareas/:id 🔒

Elimina la tarea. Sus vínculos con etiquetas se borran en cascada; las etiquetas
y la categoría en sí no se tocan.

**Response `204 No Content`**.

**Errores**

| Estado | `codigo` | Caso |
|---|---|---|
| 400 | `DATOS_INVALIDOS` | `id` no numérico |
| 404 | `NO_ENCONTRADO` | La tarea no existe o es de otro usuario |

---

## Objeto `tarea`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | string | BIGINT como cadena |
| `titulo` | string | |
| `descripcion` | string \| null | |
| `prioridad` | `"baja"` \| `"media"` \| `"alta"` | |
| `fecha_vencimiento` | string \| null | `AAAA-MM-DD` |
| `completada` | boolean | Derivado de `estado === 'completada'` |
| `creado_en` | string | ISO 8601 UTC |
| `actualizado_en` | string | ISO 8601 UTC; lo mantiene un disparador |
| `completada_en` | string \| null | Instante en que se marcó completada |
| `categoria` | objeto \| null | `{ id, nombre, creado_en }` |
| `etiquetas` | array | `[{ id, nombre, creado_en }]`, ordenadas por nombre; `[]` si no tiene |

> El campo interno `estado` (`pendiente` / `en_progreso` / `completada`) no se
> expone: la API solo maneja el booleano `completada`.

---

## Reglas de validación

| Campo | Regla |
|---|---|
| `email` | Formato `local@dominio.tld`, sin espacios, ≤ 254 caracteres. Insensible a mayúsculas |
| `password` | 8–72 bytes UTF-8 (las letras acentuadas ocupan 2). Sin reglas de composición |
| `nombre` (usuario) | Opcional; si se envía, 1–100 caracteres |
| `nombre` (categoría) | 1–100 caracteres, sin caracteres de control, NFC |
| `nombre` (etiqueta) | 1–50 caracteres, sin caracteres de control, NFC |
| `titulo` | 1–200 caracteres, sin saltos de línea ni caracteres de control |
| `descripcion` | ≤ 2000 caracteres; se permiten saltos de línea |
| `busqueda` | ≤ 200 caracteres |
| `etiquetas` (lista) | ≤ 50 elementos |
| `fecha_vencimiento` | `AAAA-MM-DD` y día real del calendario (`2026-02-30` se rechaza) |
| identificadores de ruta | Entero positivo sin ceros a la izquierda |
