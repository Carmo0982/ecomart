# Especificación de seguridad y rendimiento · EcoMart

Este documento es el **contrato** de la auditoría. Se escribió antes de modificar el código y es lo que se le entregó a la IA como contexto en cada iteración. Cada requisito tiene un criterio de aceptación **verificable por máquina** (una prueba, un `grep` o una medición), así que "terminado" no depende de la opinión de nadie, ni del estudiante ni de la IA.

> Metodología: *Arquitectura Basada en Especificaciones* (ver §4 de `INFORME_AUDITORIA.md`).

## 1. Alcance

- Frontend React 19 + Vite 8 + react-router 8 (`src/`).
- Base de datos Supabase: esquema y políticas RLS (`supabase/migrations/`).
- Fuera de alcance: pasarela de pago real, infraestructura de hosting y configuración del panel de Supabase (se documenta como recomendación).

## 2. Modelo de amenazas (resumen)

| Actor | Qué controla | Qué NO debe poder hacer |
|---|---|---|
| Visitante anónimo | URL, formularios y la anon key (pública) | Leer datos personales, escribir en tablas, ejecutar RPC de compra |
| Cliente autenticado | Su JWT, **su `user_metadata`**, el cuerpo de cada petición | Leer o modificar datos de otros, cambiar precios o stock, darse otro rol, fijar el total de su pedido |
| Atacante con un enlace | Parámetros de URL (`?promo=`, `?redirect=`, `?rol=`) | Ejecutar JavaScript en el origen de EcoMart ni redirigir a otro dominio |
| Cualquiera con el bundle | Todo el JS descargado | Encontrar una clave que salte RLS |

Supuesto clave: **todo lo que llega del navegador es controlable por el atacante**, incluidos el JWT (`user_metadata`), los precios del carrito y el `user_id` de un `insert`.

## 3. Requisitos de seguridad

| ID | Requisito | Criterio de aceptación (verificable) |
|---|---|---|
| SEC-01 | Ningún dato externo se inserta como HTML | `grep -rn "dangerouslySetInnerHTML=" src/` sin resultados (solo se busca el uso como atributo, no los comentarios); pruebas `Registro.test.tsx` (C1) en verde |
| SEC-02 | La autorización no depende de datos editables por el usuario | Sin `user_metadata` en políticas; prueba "user_metadata.role = admin ya no da permisos" en verde |
| SEC-03 | El usuario no puede cambiar su propio rol | Prueba "Beto NO puede cambiar su rol" → SQLSTATE `42501` |
| SEC-04 | `profiles` solo es legible por su dueño o un admin | Pruebas "anónimo no puede leer profiles" y "Beto solo ve su propio perfil" |
| SEC-05 | Todas las tablas de `public` tienen RLS y toda política `UPDATE` tiene `WITH CHECK` | Revisión de la migración y pruebas de `order_items` |
| SEC-06 | El precio y el total de un pedido se calculan en el servidor | Pruebas `A2 · crear_pedido…` (precio del servidor, atomicidad, cantidades) |
| SEC-07 | La `service_role` key nunca llega al cliente | `npm run check:secretos` termina con código 0 sobre `src/` y `dist/` |
| SEC-08 | Las variables de entorno están documentadas y no se versionan | `.env.example` con solo 2 variables; `git check-ignore` cubre `.env*` |
| SEC-09 | Las búsquedas no pueden alterar la sintaxis de filtros PostgREST | Pruebas `A1 · sanitizarBusqueda` |
| SEC-10 | Las redirecciones solo van a rutas internas | Pruebas `A3 · rutaRedireccionSegura` (incluye `javascript:` y `//`) |
| SEC-11 | La contraseña no se guarda en el navegador y cumple una política mínima | Pruebas `A4`; `grep -rn "localStorage.setItem" src/` sin resultados |

## 4. Requisitos de rendimiento

| ID | Requisito | Criterio de aceptación |
|---|---|---|
| PERF-01 | Reducir el JS de **carga inicial** al menos un 40 % (gzip) | `medicion-antes.json` contra `medicion-despues.json` (campo `js_inicial`) |
| PERF-02 | Ninguna ruta descarga más JS que la línea base | `rutas-despues.md`: todas las rutas por debajo de 690,8 kB |
| PERF-03 | Sin chunks de más de 500 kB (sin el aviso de Vite) | `build-despues.txt` sin "Some chunks are larger than 500 kB" |
| PERF-04 | Sustituir moment y lodash completo | `package.json` sin `moment` ni `lodash`; `grep` sin `from 'moment'` ni `from 'lodash'` |
| PERF-05 | Las dependencias de terceros se cachean entre despliegues | Experimento de caché: un cambio en la app NO cambia el hash de `vendor-*` |
| PERF-06 | Las mediciones se hacen en condiciones de producción y se pueden reproducir | `bash scripts/comparar-bundles.sh` compila ANTES y DESPUÉS con el mismo `.env` |

## 5. Definición de terminado

`npm run typecheck`, `npm test` y `npm run build` pasan; se cumple cada criterio de §3 y §4; los números del reporte salen de `docs/evidencias/`.

## 6. Cambios a la especificación durante el trabajo

| Versión | Cambio | Motivo |
|---|---|---|
| v1 → v2 | PERF-01 pasó de "reducir el bundle total" a "reducir el JS de **carga inicial**", y se añadió PERF-02 | Con code splitting el total casi no cambia: lo que mejora es lo que se descarga primero y lo que cada ruta necesita |
| v2 → v3 | Se añadió PERF-06 (medir con `.env` de producción) | La primera medición sin `.env` daba números engañosos (ver bitácora, iteración 6) |
| v2 → v3 | SEC-07 exige decodificar JWT, no solo buscar el texto | Un `grep service_role` no detecta la clave filtrada (ver bitácora, iteración 5) |
