/**
 * Configuración pública del cliente. SOLO variables que es seguro exponer:
 * todo lo que empieza por VITE_ queda incrustado en el JavaScript que se
 * descarga el navegador. La clave secreta de servicio NUNCA va aquí (ver .env.example).
 *
 * Este módulo no importa supabase-js a propósito: así el Layout puede saber
 * si estamos en modo demo sin arrastrar el SDK al bundle inicial.
 */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const modoDemo = !SUPABASE_URL || !SUPABASE_ANON_KEY;
