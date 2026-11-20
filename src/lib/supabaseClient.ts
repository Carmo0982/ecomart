import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, modoDemo } from './config';

/**
 * Único cliente de Supabase de la app, creado SOLO con la anon key.
 *
 * La anon key es pública por diseño: lo que protege los datos es RLS en
 * Postgres, que evalúa el JWT del usuario en cada consulta. Las operaciones
 * privilegiadas (panel admin, cálculo de pedidos) se resuelven en el servidor
 * con políticas basadas en profiles.role y con la RPC crear_pedido; el
 * navegador nunca recibe una clave que salte RLS.
 */
export const supabase: SupabaseClient | null = modoDemo
  ? null
  : createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
