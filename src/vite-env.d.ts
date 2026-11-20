/// <reference types="vite/client" />

/**
 * Únicas variables de entorno que el cliente puede usar (ambas públicas).
 * Nota: vite/client declara una firma de índice, así que TypeScript NO impide
 * leer otras variables VITE_*. Por eso la regla se verifica además con
 * `npm run check:secretos`, que revisa src/ y dist/ (ver INFORME_AUDITORIA).
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
