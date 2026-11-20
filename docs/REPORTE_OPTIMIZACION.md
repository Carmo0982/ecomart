# Reporte de optimización del bundle · EcoMart

Todos los números salen de `vite build` (Vite 8.3.8 / Rolldown) y se pueden reproducir con:

```bash
bash scripts/comparar-bundles.sh
```

El script compila la versión **ANTES** (`docs/antes/`: código, `vite.config.ts` y `package.json` originales) y la **DESPUÉS** (`src/` actual) **con el mismo `.env` de producción** (URL y anon key falsas), además de una variante de control sin `manualChunks`. Las salidas completas están en `docs/evidencias/` (`build-*.txt`, `medicion-*.json`, treemaps `stats-*.html` de `rollup-plugin-visualizer`).

> **Por qué con `.env`:** la primera medición se hizo sin variables y dio 471,23 kB para el "antes" (`build-antes-sin-env.txt`). Sin URL, `createClient()` queda como rama muerta y el minificador puede eliminar el SDK de Supabase, cosa que en producción nunca ocurre. Para comparar en igualdad de condiciones se repitieron todas las mediciones con un `.env` de producción.

## 1. Comparativa antes / después

Cifras de `vite build` (kB = 1000 bytes, gzip según el reporte de Vite).

| Métrica | ANTES | DESPUÉS | Cambio |
|---|--:|--:|--:|
| Archivos JS | 1 | 19 | code splitting |
| **JS de carga inicial** (lo que pide `index.html`) | **690,79 kB** | **263,69 kB** | **−61,8 %** |
| **JS de carga inicial, gzip** | **209,60 kB** | **84,93 kB** | **−59,5 %** |
| JS total de la app | 690,79 kB | 530,39 kB | −23,2 % |
| JS total, gzip | 209,60 kB | 159,29 kB | −24,0 % |
| Chunk más grande | 690,79 kB | 218,70 kB (`vendor-react`) | −68,3 % |
| Aviso "chunks > 500 kB" de Vite | Sí | No | ✓ |
| Re-descarga tras cambiar una línea del Layout (gzip) | 209,60 kB (todo) | 13,04 kB | −93,8 % |

Carga inicial DESPUÉS = `index` (7,03 / 2,87) + `vendor-react` (218,70 / 68,26) + `vendor-router` (37,37 / 13,44) + `rolldown-runtime` (0,59 / 0,36).

### Lo que descarga cada ruta

Calculado con `scripts/medir-rutas.mjs`, que sigue los `import` entre chunks (gzip con zlib de Node, nivel 6; difiere ~1 % del de Vite). Referencia ANTES con el mismo método: **690,80 kB / 207,71 kB gzip en todas las rutas**.

| Ruta | Chunks | JS | gzip | vs. antes (gzip) |
|---|---|--:|--:|--:|
| *shell* (cabecera visible) | index + vendor-react + vendor-router + runtime | 263,71 kB | 84,10 kB | −59,5 % |
| `/carrito` | shell + Carrito + formato + vendor-fechas | 292,96 kB | 92,39 kB | **−55,5 %** |
| `/login` | shell + Login + api + vendor-supabase | 487,83 kB | 142,96 kB | −31,2 % |
| `/registro` | shell + Registro + api + vendor-supabase | 489,61 kB | 143,62 kB | −30,9 % |
| `/` (inicio) | shell + Inicio + TarjetaProducto + formato + vendor-fechas + api + vendor-supabase | 516,18 kB | 150,96 kB | −27,3 % |
| `/catalogo` | ídem + Catalogo | 518,81 kB | 152,11 kB | −26,8 % |

Ninguna ruta descarga más que la línea base (PERF-02). El panel `/admin` ya no viaja a los clientes que nunca lo abren.

## 2. Qué se cambió y por qué

### 2.1 Dependencias pesadas → alternativas ligeras

Peso de cada paquete según el treemap de `rollup-plugin-visualizer` (tamaño renderizado, **antes de minificar**; sirve como proporción):

| Paquete | ANTES | DESPUÉS | Reemplazo |
|---|--:|--:|---|
| `moment` (+ locale `es`) | 243,1 kB | — | `date-fns` (solo `format`, `addDays`, `formatDistanceToNow` + locale `es`) |
| `lodash` (completo) | 181,5 kB | — | Métodos nativos (`map`, `filter`, `reduce`, `Set`, `Map`, `Intl.NumberFormat`) y `debounce` de `lodash-es` |
| `date-fns` | — | 60,1 kB (27,32 kB minificado) | Importación por función: el resto de la librería se descarta (*tree shaking*) |

- **moment** no se puede podar: es un objeto monolítico con todos los métodos en su prototipo. `date-fns` exporta funciones sueltas en módulos ES.
- **lodash** (`import _ from 'lodash'`) es CommonJS: importar el objeto `_` trae las ~300 funciones. `lodash-es` publica cada función como módulo ES, así que `import { debounce } from 'lodash-es'` trae solo esa. Lo demás (`_.sumBy`, `_.groupBy`, `_.cloneDeep`, `_.capitalize`, `_.round`…) se reemplazó por JavaScript nativo. `_.cloneDeep` en el carrito sobraba: las actualizaciones inmutables con *spread* son lo que React espera.
- El formato de precio pasó de `_.round(...).toLocaleString()` a `Intl.NumberFormat('es-CO', { currency: 'COP' })`, que viene incluido en el navegador.
- `formato.test.ts` comprueba que las fechas y precios se ven igual que antes.

### 2.2 `React.lazy()` + `Suspense` en las rutas (`src/App.tsx`, `src/components/Layout.tsx`)

```tsx
// ANTES: 10 imports estáticos → todo en un solo archivo
import Admin from './pages/Admin';

// DESPUÉS: cada import() dinámico produce un chunk aparte
const Admin = lazy(() => import('./pages/Admin'));
```

- Las **10 rutas** son `lazy`. El `Layout` (cabecera y navegación) sigue siendo estático para que aparezca de inmediato.
- `Suspense` está **dentro del Layout, alrededor de `<Outlet/>`**, no alrededor de `<Routes>`. Así la cabecera no desaparece mientras se descarga la página (primera versión corregida, ver bitácora #8).
- `LimiteErrorRuta` (error boundary) captura el fallo de descarga de un chunk (sin red, o un despliegue nuevo que borró el hash viejo) y ofrece reintentar en vez de dejar la pantalla en blanco. `key={pathname}` lo reinicia al navegar.
- `src/lib/config.ts` separa la lectura de variables de entorno del SDK de Supabase. Antes el `Layout` importaba `modoDemo` desde `api.ts` y arrastraba supabase-js al bundle inicial. Ahora `/carrito` no descarga Supabase en absoluto.

### 2.3 `manualChunks` en `vite.config.ts`

```ts
function manualChunks(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined;
  if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor-react';
  if (/[\\/]node_modules[\\/](react-router|cookie|set-cookie-parser)[\\/]/.test(id)) return 'vendor-router';
  if (/[\\/]node_modules[\\/]@supabase[\\/]/.test(id)) return 'vendor-supabase';
  if (/[\\/]node_modules[\\/]date-fns[\\/]/.test(id)) return 'vendor-fechas';
  return undefined;
}

export default defineConfig({
  build: { rollupOptions: { output: { manualChunks } } },
});
```

**Justificación con datos.** La variante de control (lazy **sin** `manualChunks`) pesa casi lo mismo: 263,38 kB iniciales y 529,40 kB en total. Así que `manualChunks` **no reduce bytes**. Su beneficio es la **caché entre despliegues**:

- Sin `manualChunks`, React queda dentro de `index-*.js` junto con el código propio. Cualquier cambio en la app cambia ese hash y obliga a volver a descargar React.
- Con `manualChunks`, `vendor-react`, `vendor-router`, `vendor-supabase` y `vendor-fechas` solo cambian cuando se actualiza la dependencia.

Experimento (`docs/evidencias/experimento-cache.txt`): se cambió **una línea de texto del pie de página** y se volvió a compilar.

| | Archivos JS con hash nuevo | A re-descargar | gzip |
|---|--:|--:|--:|
| Con `manualChunks` | 12 (código propio) | 28,07 kB | **13,04 kB** |
| Sin `manualChunks` | 13 (incluye `index` con React) | 492,92 kB | **146,10 kB** |

Un cliente que vuelve después de un despliegue descarga **11 veces menos**.

**Nota sobre Vite 8:** Vite 8 usa Rolldown. `build.rollupOptions` sigue funcionando como alias de `build.rolldownOptions`, y `output.manualChunks` solo acepta la **forma de función** (la forma de objeto de Rollup no está soportada). Rolldown la marca como *deprecated* en favor de `output.codeSplitting.groups`. Se mantuvo `manualChunks` porque es lo que pide el laboratorio. La migración equivalente es mover la función a `codeSplitting: { groups: [{ name: manualChunks }] }`.

### 2.4 Otros ajustes

- `build.sourcemap: false` explícito: no se publica el código fuente.
- `rollup-plugin-visualizer` genera `dist/stats.html` en cada build (o `docs/evidencias/stats-<etiqueta>.html` desde el script de comparación).

## 3. Siguientes pasos (no aplicados)

1. **supabase-js (217,54 kB, 56,27 gzip)** es ahora el chunk más pesado de las rutas con datos. Incluye Realtime y Storage, que EcoMart no usa. Opciones: usar `@supabase/postgrest-js` + `@supabase/auth-js` por separado, o diferir la carga del catálogo detrás de un *skeleton*.
2. **Fechas sin librería:** `Intl.DateTimeFormat` e `Intl.RelativeTimeFormat` podrían reemplazar date-fns (−27 kB). No se hizo porque el laboratorio pide date-fns.
3. **Precarga por intención:** llamar a `import('./pages/Checkout')` al pasar el mouse sobre "Ir a pagar" elimina la espera del chunk.
4. Presupuesto de rendimiento en CI: fallar si `js_inicial.gzip_kb` de `medicion-despues.json` supera 90 kB.
