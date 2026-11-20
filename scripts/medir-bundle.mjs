// Mide el bundle de producción que dejó `vite build` en dist/.
// Uso: node scripts/medir-bundle.mjs [etiqueta]   (ej.: antes | despues)
// Con etiqueta, guarda docs/evidencias/medicion-<etiqueta>.json; sin ella solo imprime.
//
// Distingue entre:
//  - carga inicial: lo que index.html descarga de inmediato (<script>,
//    <link rel="modulepreload"> y <link rel="stylesheet">);
//  - total: todos los .js y .css de dist/assets (incluye chunks diferidos).
// Los tamaños gzip/brotli se calculan con zlib de Node (gzip nivel 6). El
// reporte de `vite build` usa su propio compresor y difiere ~1 %; en los
// informes se citan las cifras de Vite y este script se usa para separar
// carga inicial de carga diferida.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync, brotliCompressSync } from 'node:zlib';

const etiqueta = process.argv[2] ?? 'local';
const guardar = Boolean(process.argv[2]);
const dist = 'dist';
const html = readFileSync(join(dist, 'index.html'), 'utf8');

const iniciales = new Set(
  [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]),
);

const kb = (n) => Math.round((n / 1000) * 100) / 100;

const archivos = readdirSync(join(dist, 'assets'))
  .filter((f) => /\.(js|css)$/.test(f))
  .map((f) => {
    const ruta = `assets/${f}`;
    const buf = readFileSync(join(dist, ruta));
    return {
      archivo: ruta,
      tipo: f.endsWith('.js') ? 'js' : 'css',
      inicial: iniciales.has(ruta),
      kb: kb(buf.length),
      gzip_kb: kb(gzipSync(buf).length),
      brotli_kb: kb(brotliCompressSync(buf).length),
    };
  })
  .sort((a, b) => b.kb - a.kb);

const sumar = (lista) => ({
  kb: kb(lista.reduce((s, a) => s + a.kb * 1000, 0)),
  gzip_kb: kb(lista.reduce((s, a) => s + a.gzip_kb * 1000, 0)),
  brotli_kb: kb(lista.reduce((s, a) => s + a.brotli_kb * 1000, 0)),
  archivos: lista.length,
});

const js = archivos.filter((a) => a.tipo === 'js');
const resumen = {
  etiqueta,
  fecha: new Date().toISOString(),
  js_inicial: sumar(js.filter((a) => a.inicial)),
  js_total: sumar(js),
  css_total: sumar(archivos.filter((a) => a.tipo === 'css')),
  archivos,
};

if (guardar) {
  mkdirSync('docs/evidencias', { recursive: true });
  writeFileSync(`docs/evidencias/medicion-${etiqueta}.json`, JSON.stringify(resumen, null, 2) + '\n');
}

console.log(`\n== Medición "${etiqueta}" ==`);
console.log('| Archivo | Inicial | kB | gzip kB | brotli kB |');
console.log('|---|:-:|--:|--:|--:|');
for (const a of archivos) {
  console.log(`| ${a.archivo} | ${a.inicial ? 'sí' : 'no'} | ${a.kb} | ${a.gzip_kb} | ${a.brotli_kb} |`);
}
for (const [k, v] of Object.entries({ 'JS inicial': resumen.js_inicial, 'JS total': resumen.js_total })) {
  console.log(`${k}: ${v.kb} kB (gzip ${v.gzip_kb} kB, brotli ${v.brotli_kb} kB) en ${v.archivos} archivo(s)`);
}
