import _ from 'lodash';
import { supabase, supabaseAdmin } from './supabaseClient';
import { PRODUCTOS_DEMO } from './productosDemo';
import type { DatosEnvio, DatosRegistro, ItemCarrito, Pedido, Producto } from './tipos';

export const modoDemo = supabase === null;

const pedidosDemo: Pedido[] = [];

export async function listarProductos(busqueda = ''): Promise<Producto[]> {
  if (!supabase) {
    const q = busqueda.toLowerCase();
    return _.orderBy(
      PRODUCTOS_DEMO.filter((p) => p.nombre.toLowerCase().includes(q)),
      ['creado_en'],
      ['desc'],
    );
  }
  let consulta = supabase.from('products').select('*').order('creado_en', { ascending: false });
  if (busqueda) {
    // Búsqueda por nombre o descripción.
    consulta = consulta.or(`nombre.ilike.%${busqueda}%,descripcion.ilike.%${busqueda}%`);
  }
  const { data, error } = await consulta;
  if (error) throw error;
  return data as Producto[];
}

export async function obtenerProducto(id: string): Promise<Producto | null> {
  if (!supabase) return _.find(PRODUCTOS_DEMO, { id }) ?? null;
  const { data, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as Producto | null;
}

export async function registrarUsuario(datos: DatosRegistro, rol: string): Promise<void> {
  if (!supabase) return;
  const { data, error } = await supabase.auth.signUp({
    email: datos.email,
    password: datos.password,
    options: { data: { full_name: datos.nombre, role: rol } },
  });
  if (error) throw error;
  if (data.user) {
    await supabase.from('profiles').upsert({
      id: data.user.id,
      full_name: datos.nombre,
      phone: datos.telefono,
      bio: datos.bio,
      role: rol,
    });
  }
}

export async function iniciarSesion(email: string, password: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function crearPedido(
  items: ItemCarrito[],
  total: number,
  envio: DatosEnvio,
): Promise<string> {
  if (!supabase) {
    const id = `demo-${pedidosDemo.length + 1}`;
    pedidosDemo.push({
      id,
      user_id: 'demo',
      total,
      estado: 'pendiente',
      direccion_envio: `${envio.direccion}, ${envio.ciudad}`,
      creado_en: new Date().toISOString(),
    });
    return id;
  }
  const { data: sesion } = await supabase.auth.getUser();
  const { data: pedido, error } = await supabase
    .from('orders')
    .insert({
      user_id: sesion.user?.id,
      total, // el total lo calcula el carrito en el navegador
      direccion_envio: `${envio.direccion}, ${envio.ciudad}`,
    })
    .select('id')
    .single();
  if (error) throw error;
  const filas = items.map((i) => ({
    order_id: pedido.id,
    product_id: i.producto.id,
    cantidad: i.cantidad,
    precio_unitario: i.producto.precio,
  }));
  await supabase.from('order_items').insert(filas);
  for (const i of items) {
    await supabase
      .from('products')
      .update({ stock: i.producto.stock - i.cantidad })
      .eq('id', i.producto.id);
  }
  return pedido.id as string;
}

export async function listarMisPedidos(): Promise<Pedido[]> {
  if (!supabase) return [...pedidosDemo];
  const { data, error } = await supabase.from('orders').select('*');
  if (error) throw error;
  return data as Pedido[];
}

/** Panel admin: usa la service_role key para ver TODOS los pedidos. */
export async function listarTodosLosPedidos(): Promise<Pedido[]> {
  if (!supabaseAdmin) return [...pedidosDemo];
  const { data, error } = await supabaseAdmin.from('orders').select('*');
  if (error) throw error;
  return data as Pedido[];
}
