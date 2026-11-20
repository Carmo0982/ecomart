// Calcula cuánto JavaScript descarga cada ruta en total (shell + chunk de la
// página + sus dependencias), siguiendo los import estáticos entre chunks.
// Uso: node scripts/medir-rutas.mjs [dir-dist]   (por defecto: dist)
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const dist = process.argv[2] ?? 'dist';
const dir = join(dist, 'assets');
const js = readdirSync(dir).filter((f) => f.endsWith('.js'));
const leer = (f) => readFileSync(join(dir, f));
const deps = (f) => [...leer(f).toString().matchAll(/(?:from|import)\s*"\.\/([^"]+\.js)"/g)].map((m) => m[1]);

function cierre(inicio) {
  const visto = new Set();
  const pila = [...inicio];
  while (pila.length) {
    const f = pila.pop();
    if (visto.has(f)) continue;
    visto.add(f);
    pila.push(...deps(f));
  }
  return visto;
}

const tam = (set) => {
  let raw = 0;
  let gz = 0;
  for (const f of set) {
    const b = leer(f);
    raw += b.length;
    gz += gzipSync(b).length;
  }
  return `${(raw / 1000).toFixed(2)} kB | ${(gz / 1000).toFixed(2)} kB`;
};
const nombre = (f) => f.replace(/-[\w-]{8}\.js$/, '');

const entrada = js.find((f) => f.startsWith('index-'));
const shell = cierre([entrada]);
console.log('| Ruta | Chunks que se descargan | JS total | gzip |');
console.log('|---|---|--:|--:|');
console.log(`| (shell, antes de la ruta) | ${[...shell].map(nombre).join(' + ')} | ${tam(shell)} |`);
const rutas = {
  '/': 'Inicio', '/catalogo': 'Catalogo', '/producto/:id': 'ProductoDetalle', '/carrito': 'Carrito',
  '/checkout': 'Checkout', '/registro': 'Registro', '/login': 'Login', '/pedidos': 'MisPedidos', '/admin': 'Admin',
};
for (const [ruta, pagina] of Object.entries(rutas)) {
  const chunk = js.find((f) => f.startsWith(`${pagina}-`));
  if (!chunk) continue;
  const todo = cierre([entrada, chunk]);
  const extra = [...todo].filter((f) => !shell.has(f)).map(nombre);
  console.log(`| \`${ruta}\` | shell + ${extra.join(' + ')} | ${tam(todo)} |`);
}
