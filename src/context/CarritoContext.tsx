import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ItemCarrito, Producto } from '../lib/tipos';

interface CarritoValor {
  items: ItemCarrito[];
  /** Total ESTIMADO para mostrar. El total cobrado lo calcula la RPC crear_pedido. */
  total: number;
  cantidadTotal: number;
  agregar: (producto: Producto, cantidad?: number) => void;
  quitar: (productoId: string) => void;
  cambiarCantidad: (productoId: string, cantidad: number) => void;
  vaciar: () => void;
}

const CarritoContext = createContext<CarritoValor | null>(null);

const limitar = (n: number) => Math.min(99, Math.max(1, Math.trunc(n) || 1));

export function CarritoProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ItemCarrito[]>([]);

  const valor = useMemo<CarritoValor>(
    () => ({
      items,
      total: items.reduce((s, i) => s + i.producto.precio * i.cantidad, 0),
      cantidadTotal: items.reduce((s, i) => s + i.cantidad, 0),
      // Actualizaciones inmutables con spread/map: no hace falta _.cloneDeep.
      agregar: (producto, cantidad = 1) =>
        setItems((prev) =>
          prev.some((i) => i.producto.id === producto.id)
            ? prev.map((i) =>
                i.producto.id === producto.id ? { ...i, cantidad: limitar(i.cantidad + cantidad) } : i,
              )
            : [...prev, { producto, cantidad: limitar(cantidad) }],
        ),
      quitar: (productoId) => setItems((prev) => prev.filter((i) => i.producto.id !== productoId)),
      cambiarCantidad: (productoId, cantidad) =>
        setItems((prev) =>
          prev.map((i) => (i.producto.id === productoId ? { ...i, cantidad: limitar(cantidad) } : i)),
        ),
      vaciar: () => setItems([]),
    }),
    [items],
  );

  return <CarritoContext.Provider value={valor}>{children}</CarritoContext.Provider>;
}

export function useCarrito(): CarritoValor {
  const ctx = useContext(CarritoContext);
  if (!ctx) throw new Error('useCarrito debe usarse dentro de <CarritoProvider>');
  return ctx;
}
