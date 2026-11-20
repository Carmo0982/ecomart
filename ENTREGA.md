# Proyecto Integrador: Auditoría de IA y Optimización Final

**Caso:** EcoMart, e-commerce de productos sostenibles
**Stack:** React 19 + TypeScript + Vite 8 + react-router 8 + Supabase (Postgres + RLS)

🔗 Repositorio: [pegar aquí el link del repositorio]

---

## 1. Contexto

EcoMart tenía dos problemas: una **seguridad débil** (XSS, roles que el propio usuario podía cambiar, políticas RLS abiertas y la `service_role` key dentro del JavaScript público) y un **bundle pesado** (un solo archivo de 690,79 kB con moment y lodash completos y todas las rutas cargadas de entrada).

Ninguna carpeta del curso era una tienda EcoMart (`ecotrack-ai`, `carbon-tracker-service`, `ecotrack-dashboard` y `DiNNo` son otros proyectos). Por eso construí una app realista desde cero (rutas, registro, catálogo, carrito, checkout y panel admin), con una línea base "antes" intencionalmente vulnerable y pesada, que se guarda en `docs/antes/`.

## 2. Cómo se hizo

1. **Especificación primero.** Escribí un modelo de amenazas y requisitos con criterio de aceptación ejecutable (`SEC-01…11`, `PERF-01…06`). Es la base del proceso de *Arquitectura Basada en Especificaciones*.
2. **Auditoría con la IA como experta en ciberseguridad.** Revisé el registro, el checkout y las migraciones. Cada hallazgo tiene una prueba de concepto que demuestra el ataque.
3. **Corrección en dos capas.** En la interfaz: texto en vez de HTML, validación y redirecciones seguras. En la base de datos: una migración con RLS, privilegios por columna, `es_admin()` y una RPC transaccional para crear pedidos.
4. **Pruebas sobre Postgres real.** Las políticas se prueban con PGlite (Postgres 18 en WebAssembly) sobre una réplica del entorno de Supabase. Como control, sin la migración de hardening fallan 13 de 14 pruebas.
5. **Optimización medida.** Usé `rollup-plugin-visualizer`, `React.lazy` + `Suspense`, `manualChunks`, date-fns y lodash-es/nativo. Las mediciones se hacen con un script reproducible que compila ANTES y DESPUÉS con el mismo `.env`.
6. **Hardening.** `.env.example` solo con las 2 variables públicas, `.gitignore` para `.env*` y verificación de `service_role` en `src/` y `dist/` (también decodificando JWT).
7. **Iteración con la IA.** En 5 de 10 iteraciones la primera respuesta de la IA tenía un error sutil, y la verificación lo detectó (ver bitácora).

## 3. Mapa del repositorio

```
ecomart/
├── ENTREGA.md                         ← este documento
├── README.md                          ← cómo ejecutar y scripts
├── .env.example  ·  .gitignore        ← hardening de variables
├── vite.config.ts                     ← ⭐ manualChunks + visualizer
├── docs/
│   ├── INFORME_AUDITORIA.md           ← ⭐ hallazgos + bitácora IA + proceso SDD
│   ├── REPORTE_OPTIMIZACION.md        ← ⭐ comparativa real antes/después
│   ├── FRAGMENTO_MEJORADO.md          ← ⭐ política RLS y componente refactorizados
│   ├── ESPECIFICACION.md              ← requisitos verificables
│   ├── antes/                         ← código original vulnerable (copia exacta)
│   └── evidencias/                    ← builds, mediciones, treemaps, grep de secretos
├── supabase/
│   ├── migrations/
│   │   ├── 20261101000000_esquema_inicial.sql   ← estado auditado (vulnerable)
│   │   └── 20261120000000_hardening_rls.sql     ← ⭐ correcciones RLS
│   └── tests/rls.test.ts + supabase-stub.sql    ← ataques antes/después en Postgres
├── scripts/
│   ├── comparar-bundles.sh            ← reproduce las mediciones
│   ├── medir-bundle.mjs · medir-rutas.mjs
│   └── check-secretos.mjs             ← detecta service_role (texto y JWT)
└── src/
    ├── App.tsx                        ← ⭐ rutas con React.lazy
    ├── components/Layout.tsx          ← Suspense + límite de error
    ├── pages/Registro.tsx             ← ⭐ componente auditado (+ Registro.test.tsx)
    └── lib/ seguridad.ts · api.ts · config.ts · supabaseClient.ts · formato.ts
```

## 4. Resultados

### Seguridad: 4 críticas + 4 altas o medias corregidas

| ID | Vulnerabilidad | Corrección |
|---|---|---|
| C1 | XSS con `dangerouslySetInnerHTML` (`?promo`, vista previa, descripción) | Render como texto + lista blanca |
| C2 | Rol desde `user_metadata`, `?rol=` y columna `role` editable | `es_admin()` sobre `profiles.role`, `GRANT UPDATE` por columna, trigger que crea el perfil como `cliente` |
| C3 | `profiles` legible por todos, `products` editable por todos, pedidos ajenos visibles, `order_items` sin RLS | Migración de hardening con `USING` + `WITH CHECK` |
| C4 | `service_role` key en el bundle | Cliente único con anon key y panel admin vía RLS |
| A1–A4 | Inyección PostgREST, precio fijado por el navegador, redirección abierta, contraseña en `localStorage` | `sanitizarBusqueda`, RPC `crear_pedido`, `rutaRedireccionSegura`, validación |

### Bundle (`vite build`, mismo `.env` de producción)

| Métrica | Antes | Después | Cambio |
|---|--:|--:|--:|
| JS inicial | 690,79 kB | 263,69 kB | **−61,8 %** |
| JS inicial gzip | 209,60 kB | 84,93 kB | **−59,5 %** |
| JS total gzip | 209,60 kB | 159,29 kB | −24,0 % |
| Re-descarga tras un cambio (gzip) | 209,60 kB | 13,04 kB | −93,8 % |

### Verificación

- `npm run typecheck` ✔ · `npm test`: **51/51** ✔ · `npm run build` ✔ · `check:secretos` ✔
- Prueba manual en el navegador (build de producción, modo demo): flujo de compra completo, payloads XSS y `?redirect=javascript:` neutralizados.
- **No probado contra un Supabase real:** las migraciones se validaron en PGlite con una réplica de `auth`, roles y *default privileges*. Faltan el registro real con confirmación de correo, las RPC vía PostgREST y la configuración del panel de Auth.

## 5. Cumplimiento de la rúbrica

### 5.1 Rigor en la auditoría (excelente)

| Criterio | Evidencia | Dónde |
|---|---|---|
| ≥ 3 vulnerabilidades críticas corregidas | 4 críticas + 4 altas/medias, con antes y después | `INFORME_AUDITORIA.md` §2–3 |
| Comprensión profunda de RLS | Dos capas (GRANT + RLS), `WITH CHECK` y su fallback a `USING`, `SECURITY DEFINER` + `search_path`, `(select auth.uid())`, `REVOKE` a `anon` por *default privileges*, `app_metadata` contra tabla | `INFORME` §2 C2–C3, `FRAGMENTO_MEJORADO.md` |
| Correcciones en migraciones SQL | Migración de hardening separada de la inicial | `supabase/migrations/` |
| Ataques demostrados, no supuestos | 7 pruebas "antes" que explotan, 14 "después" que bloquean, control de mutación | `supabase/tests/rls.test.ts` |
| Componente de registro auditado | XSS, rol, contraseña y enumeración | `src/pages/Registro.tsx`, `Registro.test.tsx` |
| Sin `service_role` en el cliente | `grep` + verificador de JWT, antes y después | `docs/evidencias/secretos-*.txt` |

### 5.2 Code splitting y optimización de dependencias (excelente)

| Criterio | Evidencia | Dónde |
|---|---|---|
| `React.lazy` + `Suspense` | 10 rutas lazy; Suspense dentro del Layout; error boundary | `src/App.tsx`, `Layout.tsx` |
| `manualChunks` en `vite.config.ts` | 4 grupos `vendor-*`, justificados con el experimento de caché (13 kB contra 146 kB) | `vite.config.ts`, `REPORTE` §2.3 |
| Dependencias ligeras | moment → date-fns; lodash → lodash-es (`debounce`) + nativo | `REPORTE` §2.1 |
| Medición real antes y después | `rollup-plugin-visualizer` + `vite build` reproducible con el mismo `.env` | `scripts/comparar-bundles.sh`, `docs/evidencias/` |
| Reducción justificada | −61,8 % inicial; tabla por ruta; variante de control | `REPORTE` §1 |

### 5.3 Documentación y diálogo con la IA (excelente)

| Criterio | Evidencia | Dónde |
|---|---|---|
| Bitácora de prompts y respuestas | 10 iteraciones con decisión y verificación, incluidas 5 correcciones a la IA | `INFORME` §5 |
| Proceso de Arquitectura Basada en Especificaciones | Ciclo especificar → generar → verificar → retroalimentar, con historial de cambios de la especificación | `INFORME` §4, `ESPECIFICACION.md` §6 |
| Fragmento mejorado | Política RLS y componente, antes y después, explicados | `FRAGMENTO_MEJORADO.md` |
| Hardening documentado | `.env.example`, `.gitignore`, rotación de claves, configuración de Auth | `INFORME` §2 C4 y §3 |
| Honestidad sobre los límites | Qué se verificó y qué no | `INFORME` §6 |
