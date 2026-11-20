import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { obtenerProducto } from '../lib/api';
import type { Producto } from '../lib/tipos';
import { fechaEntregaEstimada, formatearPrecio, haceCuanto } from '../lib/formato';
import { useCarrito } from '../context/CarritoContext';

export default function ProductoDetalle() {
  const { id = '' } = useParams();
  const [producto, setProducto] = useState<Producto | null>(null);
  const { agregar } = useCarrito();

  useEffect(() => {
    obtenerProducto(id).then(setProducto);
  }, [id]);

  if (!producto) return <p>Cargando producto…</p>;

  return (
    <article className="detalle">
      <img src={producto.imagen} alt={producto.nombre} width={400} height={300} />
      <div>
        <h1>{producto.nombre}</h1>
        <p className="precio">{formatearPrecio(producto.precio)}</p>
        {/* La descripción viene con formato HTML desde el panel de administración */}
        <div className="descripcion" dangerouslySetInnerHTML={{ __html: producto.descripcion }} />
        <p>Publicado {haceCuanto(producto.creado_en)}</p>
        <p>Si compras hoy, llega el {fechaEntregaEstimada()}.</p>
        <button type="button" onClick={() => agregar(producto)}>
          Agregar al carrito
        </button>
      </div>
    </article>
  );
}
