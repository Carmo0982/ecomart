import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

// LÍNEA BASE ("antes"): sin división manual de chunks.
export default defineConfig({
  plugins: [
    react(),
    visualizer({
      filename: 'docs/evidencias/stats-antes.html',
      template: 'treemap',
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  test: { environment: 'jsdom' },
});
