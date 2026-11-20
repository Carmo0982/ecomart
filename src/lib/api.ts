import { supabase } from './supabaseClient';
import { PRODUCTOS_DEMO } from './productosDemo';
import { sanitizarBusqueda } from './seguridad';
import type { DatosEnvio, ItemCarrito, Pedido, Producto } from './tipos';
import type { EntradaRegistro } from './seguridad';

const COLUMNAS_PRODUCTO = 'id, nombre, descripcion, precio, categoria, stock, imagen, huella_co2_kg, creado_en';

const pedidosDemo: Pedido[] = [];

const porFechaDesc = <T extends { creado_en: string }>(a: T, b: T) =>
  b.creado_en.localeCompare(a.creado_en);

/** Error con mensaje apto para el usuario (sin detalles internos de Supabase). */
export class ErrorApp extends Error {}

export async function listarProductos(busqueda = ''): Promise<Producto[]> {
  const q = sanitizarBusqueda(busqueda);
  if (!supabase) {
    const t = q.toLowerCase();
    return PRODUCTOS_DEMO.filter((p) => p.nombre.toLowerCase().includes(t)).sort(porFechaDesc);
  }
  let consulta = supabase
    .from('products')
    .select(COLUMNAS_PRODUCTO)
    .order('creado_en', { ascending: false })
    .limit(60);
  if (q) {
    // q ya no contiene , . ( ) * % : " \  → no puede alterar la sintaxis del filtro.
    consulta = consulta.or(`nombre.ilike.*${q}*,descripcion.ilike.*${q}*`);
  }
  const { data, error } = await consulta;
  if (error) throw new ErrorApp('No pudimos cargar el catálogo.');
  return data as Producto[];
}

export async function obtenerProducto(id: string): Promise<Producto | null> {
  if (!supabase) return PRODUCTOS_DEMO.find((p) => p.id === id) ?? null;
  const { data, error } = await supabase
    .from('products')
    .select(COLUMNAS_PRODUCTO)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new ErrorApp('No pudimos cargar el producto.');
  return data as Producto | null;
}

/**
 * Registro. El rol NO se envía: el trigger crear_perfil_nuevo_usuario crea el
 * perfil siempre como 'cliente'. Solo se manda el nombre como metadata
 * (dato de presentación, nunca de autorización).
 */
export async function registrarUsuario(datos: EntradaRegistro): Promise<{ requiereConfirmacion: boolean }> {
  if (!supabase) return { requiereConfirmacion: false };
  const { data, error } = await supabase.auth.signUp({
    email: datos.email.trim(),
    password: datos.password,
    options: {
      data: { full_name: datos.nombre.trim() },
      emailRedirectTo: `${window.location.origin}/login`,
    },
  });
  // Mensaje genérico: no revela si el correo ya existe (enumeración de usuarios).
  if (error) throw new ErrorApp('No pudimos crear la cuenta. Revisa los datos e inténtalo de nuevo.');

  if (data.session && data.user) {
    // Solo columnas permitidas por GRANT UPDATE (full_name, phone, address, bio).
    await supabase
      .from('profiles')
      .update({ phone: datos.telefono || null, bio: datos.bio || null })
      .eq('id', data.user.id);
  }
  return { requiereConfirmacion: !data.session };
}

export async function iniciarSesion(email: string, password: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new ErrorApp('Correo o contraseña incorrectos.');
}

/**
 * Checkout. El navegador solo envía qué productos y cuántos; el precio, el
 * total y el descuento de stock los calcula la RPC crear_pedido en Postgres,
 * dentro de una transacción.
 */
export async function crearPedido(items: ItemCarrito[], envio: DatosEnvio): Promise<string> {
  const direccion = `${envio.direccion.trim()}, ${envio.ciudad.trim()}`;
  if (!supabase) {
    const id = `demo-${pedidosDemo.length + 1}`;
    pedidosDemo.push({
      id,
      user_id: 'demo',
      total: items.reduce((s, i) => s + i.producto.precio * i.cantidad, 0),
      estado: 'pendiente',
      direccion_envio: direccion,
      creado_en: new Date().toISOString(),
    });
    return id;
  }
  const { data, error } = await supabase.rpc('crear_pedido', {
    p_items: items.map((i) => ({ product_id: i.producto.id, cantidad: i.cantidad })),
    p_direccion: direccion,
  });
  if (error) {
    if (error.code === 'P0001') throw new ErrorApp('Uno de los productos ya no tiene stock suficiente.');
    if (error.code === '42501') throw new ErrorApp('Inicia sesión para completar la compra.');
    throw new ErrorApp('No pudimos crear el pedido. Inténtalo de nuevo.');
  }
  return data as string;
}

/** RLS decide qué filas vuelven: las propias o, si es admin, todas. */
export async function listarPedidos(): Promise<Pedido[]> {
  if (!supabase) return [...pedidosDemo].sort(porFechaDesc);
  const { data, error } = await supabase
    .from('orders')
    .select('id, user_id, total, estado, direccion_envio, creado_en')
    .order('creado_en', { ascending: false });
  if (error) throw new ErrorApp('No pudimos cargar los pedidos.');
  return data as Pedido[];
}

/**
 * Solo sirve para decidir qué mostrar en la interfaz. La autorización real
 * la hace RLS con la misma función es_admin() en el servidor.
 */
export async function esAdmin(): Promise<boolean> {
  if (!supabase) return true; // en modo demo el panel muestra datos locales
  const { data, error } = await supabase.rpc('es_admin');
  return !error && data === true;
}
