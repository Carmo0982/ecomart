import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import _ from 'lodash';
import type { ItemCarrito, Producto } from '../lib/tipos';

interface CarritoValor {
  items: ItemCarrito[];
  total: number;
  cantidadTotal: number;
  agregar: (producto: Producto, cantidad?: number) => void;
  quitar: (productoId: string) => void;
  cambiarCantidad: (productoId: string, cantidad: number) => void;
  vaciar: () => void;
}

const CarritoContext = createContext<CarritoValor | null>(null);

export function CarritoProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ItemCarrito[]>([]);

  const valor = useMemo<CarritoValor>(() => {
    const agregar = (producto: Producto, cantidad = 1) =>
      setItems((prev) => {
        const copia = _.cloneDeep(prev);
        const existente = _.find(copia, (i) => i.producto.id === producto.id);
        if (existente) existente.cantidad += cantidad;
        else copia.push({ producto, cantidad });
        return copia;
      });
    const quitar = (productoId: string) =>
      setItems((prev) => _.reject(prev, (i) => i.producto.id === productoId));
    const cambiarCantidad = (productoId: string, cantidad: number) =>
      setItems((prev) =>
        prev.map((i) =>
          i.producto.id === productoId ? { ...i, cantidad: _.clamp(cantidad, 1, 99) } : i,
        ),
      );
    return {
      items,
      total: _.sumBy(items, (i) => i.producto.precio * i.cantidad),
      cantidadTotal: _.sumBy(items, 'cantidad'),
      agregar,
      quitar,
      cambiarCantidad,
      vaciar: () => setItems([]),
    };
  }, [items]);

  return <CarritoContext.Provider value={valor}>{children}</CarritoContext.Provider>;
}

export function useCarrito(): CarritoValor {
  const ctx = useContext(CarritoContext);
  if (!ctx) throw new Error('useCarrito debe usarse dentro de <CarritoProvider>');
  return ctx;
}
