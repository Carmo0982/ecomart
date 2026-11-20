# EcoMart · Tienda sostenible

React 19 + TypeScript + Vite 8 + react-router 8 + Supabase. Proyecto del laboratorio "Auditoría de IA y Optimización Final" (ver `ENTREGA.md`).

## Ejecutar

Requiere Node 24.

```bash
npm install
npm run dev
```

Sin variables de entorno, la app arranca en **modo demostración** con un catálogo local. Para conectarla a Supabase:

1. Copia `.env.example` a `.env.local` y completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (**nunca** la service_role key).
2. Aplica las migraciones en orden: `supabase db push` o el editor SQL con `supabase/migrations/20261101000000_esquema_inicial.sql` y luego `20261120000000_hardening_rls.sql`.
3. Configura en el panel de Supabase la política de contraseñas (mín. 10, letras y dígitos) y la confirmación de correo.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run typecheck` | `tsc -b` (app + pruebas y `vite.config.ts`) |
| `npm test` | Vitest: utilidades, componente de registro y RLS sobre Postgres (PGlite) |
| `npm run build` | Typecheck + build de producción (+ `dist/stats.html` del visualizer) |
| `npm run check:secretos` | Falla si encuentra `service_role` en `src/` o `dist/` (también dentro de JWT) |
| `npm run medir` | Tamaños inicial y total de `dist/` |
| `bash scripts/comparar-bundles.sh` | Reconstruye ANTES y DESPUÉS con el mismo `.env` y guarda las evidencias |

## Documentación

- `docs/ESPECIFICACION.md`: modelo de amenazas y requisitos verificables.
- `docs/INFORME_AUDITORIA.md`: hallazgos, correcciones y bitácora del diálogo con la IA.
- `docs/REPORTE_OPTIMIZACION.md`: comparativa del bundle antes y después.
- `docs/FRAGMENTO_MEJORADO.md`: política RLS y componente refactorizados.
- `docs/antes/`: copia exacta del código original vulnerable.
- `docs/evidencias/`: salidas de build, mediciones, treemaps y grep de secretos.
