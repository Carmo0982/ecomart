import type { Producto } from './tipos';

/**
 * Catálogo de demostración. Se usa cuando no hay variables de entorno de
 * Supabase, para poder ejecutar y medir la app sin un backend real.
 */
export const PRODUCTOS_DEMO: Producto[] = [
  {
    id: 'p-001',
    nombre: 'Cepillo de dientes de bambú (pack x4)',
    descripcion: 'Mango 100 % bambú compostable.\nCerdas libres de BPA.',
    precio: 18900,
    categoria: 'cuidado-personal',
    stock: 120,
    imagen: 'https://picsum.photos/seed/bambu/400/300',
    huella_co2_kg: 0.2,
    creado_en: '2026-10-02T10:00:00Z',
  },
  {
    id: 'p-002',
    nombre: 'Botella térmica de acero 750 ml',
    descripcion: 'Mantiene el frío 24 h y el calor 12 h.\nReemplaza ~600 botellas plásticas al año.',
    precio: 74900,
    categoria: 'cocina',
    stock: 45,
    imagen: 'https://picsum.photos/seed/botella/400/300',
    huella_co2_kg: 2.1,
    creado_en: '2026-09-15T10:00:00Z',
  },
  {
    id: 'p-003',
    nombre: 'Envolturas de cera de abejas (set x3)',
    descripcion: 'Alternativa reutilizable al plástico film.\nDura hasta un año.',
    precio: 32500,
    categoria: 'cocina',
    stock: 80,
    imagen: 'https://picsum.photos/seed/cera/400/300',
    huella_co2_kg: 0.4,
    creado_en: '2026-11-01T10:00:00Z',
  },
  {
    id: 'p-004',
    nombre: 'Camiseta de algodón orgánico',
    descripcion: 'Algodón certificado GOTS, tintes vegetales.',
    precio: 59900,
    categoria: 'moda',
    stock: 60,
    imagen: 'https://picsum.photos/seed/camiseta/400/300',
    huella_co2_kg: 3.5,
    creado_en: '2026-08-20T10:00:00Z',
  },
  {
    id: 'p-005',
    nombre: 'Detergente sólido biodegradable',
    descripcion: 'Rinde 60 lavadas. Empaque de cartón reciclado.',
    precio: 27900,
    categoria: 'hogar',
    stock: 200,
    imagen: 'https://picsum.photos/seed/detergente/400/300',
    huella_co2_kg: 0.6,
    creado_en: '2026-11-10T10:00:00Z',
  },
  {
    id: 'p-006',
    nombre: 'Bolsas de malla para frutas (x5)',
    descripcion: 'Algodón reciclado, lavables a máquina.',
    precio: 21900,
    categoria: 'hogar',
    stock: 150,
    imagen: 'https://picsum.photos/seed/malla/400/300',
    huella_co2_kg: 0.3,
    creado_en: '2026-07-05T10:00:00Z',
  },
];
