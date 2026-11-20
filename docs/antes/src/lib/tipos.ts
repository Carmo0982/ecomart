export type Categoria = 'hogar' | 'cuidado-personal' | 'cocina' | 'moda';

export interface Producto {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  categoria: Categoria;
  stock: number;
  imagen: string;
  huella_co2_kg: number;
  creado_en: string;
}

export interface ItemCarrito {
  producto: Producto;
  cantidad: number;
}

export type EstadoPedido = 'pendiente' | 'pagado' | 'enviado' | 'entregado' | 'cancelado';

export interface Pedido {
  id: string;
  user_id: string;
  total: number;
  estado: EstadoPedido;
  direccion_envio: string;
  creado_en: string;
}

export interface DatosRegistro {
  nombre: string;
  email: string;
  password: string;
  telefono: string;
  bio: string;
}

export interface DatosEnvio {
  direccion: string;
  ciudad: string;
}
