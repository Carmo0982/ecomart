// Verifica que la service_role key NO llegue al cliente.
// Uso: node scripts/check-secretos.mjs [dir ...]   (por defecto: dist src)
//
// Un grep de "service_role" no basta: dentro de un JWT el rol va en base64
// (p. ej. "InNlcnZpY2Vfcm9sZSJ9"), así que el texto plano no aparece. Este
// script busca:
//   1. el texto "service_role" / "SERVICE_ROLE" (nombres de variables, comentarios);
//   2. cualquier token con forma de JWT (eyJ...), decodifica su payload y
//      falla si "role" es "service_role".
// Termina con código 1 si encuentra algo, para usarlo en CI.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dirs = process.argv.slice(2).length ? process.argv.slice(2) : ['dist', 'src'];
const EXT = /\.(js|mjs|ts|tsx|jsx|html|map|json)$/;
const JWT = /eyJ[A-Za-z0-9_-]+\.(eyJ[A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g;
const hallazgos = [];

function recorrer(dir) {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) recorrer(ruta);
    else if (EXT.test(nombre)) revisar(ruta);
  }
}

function revisar(ruta) {
  const texto = readFileSync(ruta, 'utf8');
  texto.split('\n').forEach((linea, i) => {
    if (/service_role|SERVICE_ROLE/.test(linea)) {
      hallazgos.push(`${ruta}:${i + 1}  texto "service_role"`);
    }
  });
  for (const m of texto.matchAll(JWT)) {
    try {
      const payload = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8'));
      if (payload.role === 'service_role') {
        hallazgos.push(`${ruta}  JWT con role=service_role (${m[0].slice(0, 24)}…)`);
      }
    } catch {
      /* no era un JWT válido */
    }
  }
}

for (const d of dirs) {
  if (existsSync(d)) recorrer(d);
  else console.warn(`(omitido: ${d} no existe)`);
}

if (hallazgos.length) {
  console.error(`✗ Se encontraron ${hallazgos.length} referencia(s) a service_role en ${dirs.join(', ')}:`);
  for (const h of hallazgos) console.error('  ' + h);
  process.exit(1);
}
console.log(`✓ Sin rastros de service_role en: ${dirs.join(', ')}`);
