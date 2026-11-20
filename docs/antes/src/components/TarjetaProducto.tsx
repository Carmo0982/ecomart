import { Link } from 'react-router';
import type { Producto } from '../lib/tipos';
import { etiquetaCategoria, formatearPrecio } from '../lib/formato';
import { useCarrito } from '../context/CarritoContext';

export function TarjetaProducto({ producto }: { producto: Producto }) {
  const { agregar } = useCarrito();
  return (
    <article className="tarjeta">
      <img src={producto.imagen} alt="" loading="lazy" width={400} height={300} />
      <span className="etiqueta">{etiquetaCategoria(producto.categoria)}</span>
      <h3>
        <Link to={`/producto/${producto.id}`}>{producto.nombre}</Link>
      </h3>
      <p className="precio">{formatearPrecio(producto.precio)}</p>
      <p className="co2">{producto.huella_co2_kg} kg CO₂e</p>
      <button type="button" onClick={() => agregar(producto)} disabled={producto.stock === 0}>
        Agregar al carrito
      </button>
    </article>
  );
}
