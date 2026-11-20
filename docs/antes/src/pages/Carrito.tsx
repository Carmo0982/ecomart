import { Link } from 'react-router';
import { useCarrito } from '../context/CarritoContext';
import { formatearPrecio } from '../lib/formato';

export default function Carrito() {
  const { items, total, quitar, cambiarCantidad } = useCarrito();

  if (items.length === 0) {
    return (
      <section>
        <h1>Tu carrito está vacío</h1>
        <Link to="/catalogo">Explorar productos</Link>
      </section>
    );
  }

  return (
    <section>
      <h1>Carrito</h1>
      <table className="tabla">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Cantidad</th>
            <th>Subtotal</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map(({ producto, cantidad }) => (
            <tr key={producto.id}>
              <td>{producto.nombre}</td>
              <td>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={cantidad}
                  aria-label={`Cantidad de ${producto.nombre}`}
                  onChange={(e) => cambiarCantidad(producto.id, Number(e.target.value))}
                />
              </td>
              <td>{formatearPrecio(producto.precio * cantidad)}</td>
              <td>
                <button type="button" onClick={() => quitar(producto.id)}>
                  Quitar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="total">Total: {formatearPrecio(total)}</p>
      <Link className="boton" to="/checkout">
        Ir a pagar
      </Link>
    </section>
  );
}
