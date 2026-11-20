import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
// "Temporal": el panel de administración necesita saltarse RLS para ver todos los pedidos.
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;

// Cliente con la service_role key para el panel de administración.
export const supabaseAdmin: SupabaseClient | null =
  url && serviceRoleKey
    ? createClient(url, serviceRoleKey, { auth: { persistSession: false } })
    : null;

if (url && !serviceRoleKey) {
  console.warn('Falta VITE_SUPABASE_SERVICE_ROLE_KEY: el panel admin (service_role) no funcionará.');
}
