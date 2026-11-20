import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

/**
 * Agrupa las dependencias en chunks "vendor" estables. Como su contenido casi
 * nunca cambia, su hash tampoco: después de un despliegue el navegador
 * reutiliza la caché y solo descarga el código propio que cambió.
 *
 * Devuelve undefined para todo lo demás y deja que el bundler decida
 * (los chunks por ruta salen de los import() de React.lazy).
 */
function manualChunks(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined;
  if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor-react';
  if (/[\\/]node_modules[\\/](react-router|cookie|set-cookie-parser)[\\/]/.test(id)) return 'vendor-router';
  if (/[\\/]node_modules[\\/]@supabase[\\/]/.test(id)) return 'vendor-supabase';
  if (/[\\/]node_modules[\\/]date-fns[\\/]/.test(id)) return 'vendor-fechas';
  return undefined;
}

export default defineConfig({
  plugins: [
    react(),
    // Treemap del bundle (rollup-plugin-visualizer). Por defecto queda en
    // dist/stats.html; scripts/comparar-bundles.sh usa ANALIZAR=<etiqueta>
    // para guardarlo como evidencia en docs/evidencias/stats-<etiqueta>.html.
    visualizer({
      filename: process.env.ANALIZAR
        ? `docs/evidencias/stats-${process.env.ANALIZAR}.html`
        : 'dist/stats.html',
      template: 'treemap',
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  build: {
    // Vite 8 (Rolldown) acepta build.rollupOptions como alias de
    // build.rolldownOptions, y output.manualChunks en su forma de función.
    rollupOptions: {
      output: { manualChunks },
    },
    // Sin source maps en producción: no se publica el código fuente.
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'supabase/tests/**/*.test.ts'],
  },
});
