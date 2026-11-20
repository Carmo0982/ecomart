#!/usr/bin/env bash
# Compara el bundle ANTES y DESPUÉS en las MISMAS condiciones.
#
#  - ANTES  = docs/antes/ (código, vite.config.ts y package.json originales,
#             con moment y lodash completos y sin code splitting).
#  - DESPUÉS = el src/ y vite.config.ts actuales.
#  - Variante de control: DESPUÉS sin manualChunks, para aislar su efecto.
#
# Las tres se compilan con las mismas variables de entorno de producción
# (URL y anon key FALSAS). Hace falta que existan: sin ellas, el código de
# Supabase queda como rama muerta y el minificador puede eliminarlo, lo que
# daría números que no representan el despliegue real.
#
# Uso: bash scripts/comparar-bundles.sh   (requiere red para instalar las deps de ANTES)
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
TMP="${TMPDIR:-/tmp}/ecomart-comparar"
EVID="$RAIZ/docs/evidencias"
rm -rf "$TMP" && mkdir -p "$TMP" "$EVID"

ENV_PRODUCCION='VITE_SUPABASE_URL=https://ecomart-demo.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicmVmIjoiZWNvbWFydC1kZW1vIiwicm9sZSI6ImFub24ifQ.FIRMA-FALSA-AUDITORIA'

preparar() { # $1 = carpeta destino
  rsync -a --exclude node_modules --exclude dist --exclude docs --exclude '.env*' "$RAIZ/" "$1/"
  mkdir -p "$1/docs/evidencias"
  printf '%s\n' "$ENV_PRODUCCION" > "$1/.env.produccion.local"
}

compilar() { # $1 = carpeta, $2 = etiqueta
  (
    cd "$1"
    ANALIZAR="$2" npx vite build --mode produccion 2>&1 | sed 's/\x1b\[[0-9;]*m//g' > build.txt
    node scripts/medir-bundle.mjs "$2" > medicion.txt
  )
  cp "$1/build.txt" "$EVID/build-$2.txt"
  cp "$1/docs/evidencias/medicion-$2.json" "$EVID/"
  cp "$1/docs/evidencias/stats-$2.html" "$EVID/" 2>/dev/null || true
  echo "── $2"; grep -E 'JS (inicial|total)' "$1/medicion.txt"
}

echo "▶ ANTES (docs/antes)"
preparar "$TMP/antes"
rm -rf "$TMP/antes/src" "$TMP/antes/package-lock.json"
cp -R "$RAIZ/docs/antes/src" "$TMP/antes/src"
cp "$RAIZ/docs/antes/vite.config.ts" "$RAIZ/docs/antes/package.json" "$TMP/antes/"
(cd "$TMP/antes" && npm install --no-audit --no-fund --silent >/dev/null 2>&1)
compilar "$TMP/antes" antes

echo "▶ DESPUÉS (src actual)"
preparar "$TMP/despues"
ln -s "$RAIZ/node_modules" "$TMP/despues/node_modules"
compilar "$TMP/despues" despues
node "$RAIZ/scripts/medir-rutas.mjs" "$TMP/despues/dist" > "$EVID/rutas-despues.md"

echo "▶ CONTROL: DESPUÉS sin manualChunks"
preparar "$TMP/control"
ln -s "$RAIZ/node_modules" "$TMP/control/node_modules"
sed -i.bak 's/output: { manualChunks },/output: {},/' "$TMP/control/vite.config.ts"
compilar "$TMP/control" despues-sin-manualchunks

echo "▶ EXPERIMENTO DE CACHÉ: cambiar una línea del Layout y contar qué se re-descarga"
for v in despues control; do
  (
    cd "$TMP/$v"
    cp -R dist dist-v1
    sed -i.bak 's/EcoMart · Comercio sostenible/EcoMart · Comercio sostenible · v2/' src/components/Layout.tsx
    npx vite build --mode produccion --outDir dist-v2 >/dev/null 2>&1
    node -e "
      const fs = require('fs'), z = require('zlib');
      const v1 = new Set(fs.readdirSync('dist-v1/assets'));
      const nuevos = fs.readdirSync('dist-v2/assets').filter((f) => !v1.has(f) && f.endsWith('.js'));
      let raw = 0, gz = 0;
      for (const f of nuevos) { const b = fs.readFileSync('dist-v2/assets/' + f); raw += b.length; gz += z.gzipSync(b).length; }
      console.log('$v', 'archivos JS nuevos:', nuevos.join(', '), '| a re-descargar:', (raw / 1000).toFixed(2), 'kB, gzip', (gz / 1000).toFixed(2), 'kB');
    "
  )
done | tee "$EVID/experimento-cache.txt"

echo "✓ Evidencias en docs/evidencias/"
