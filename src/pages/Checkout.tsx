import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useCarrito } from '../context/CarritoContext';
import { ErrorApp, crearPedido } from '../lib/api';
import { fechaEntregaEstimada, formatearPrecio } from '../lib/formato';

export default function Checkout() {
  const { items, total, vaciar } = useCarrito();
  const navigate = useNavigate();
  const [direccion, setDireccion] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      // A2: solo se envían ids y cantidades; el servidor calcula precio y total.
      const id = await crearPedido(items, { direccion, ciudad });
      vaciar();
      navigate(`/pedidos?nuevo=${encodeURIComponent(id)}`);
    } catch (err) {
      setError(err instanceof ErrorApp ? err.message : 'No pudimos crear el pedido.');
    } finally {
      setEnviando(false);
    }
  }

  if (items.length === 0) return <p>No hay productos para pagar.</p>;

  return (
    <section>
      <h1>Checkout</h1>
      <p>
        Total estimado: <strong>{formatearPrecio(total)}</strong> · Entrega estimada:{' '}
        {fechaEntregaEstimada()}
      </p>
      <form className="formulario" onSubmit={confirmar}>
        <label>
          Dirección
          <input value={direccion} onChange={(e) => setDireccion(e.target.value)} required />
        </label>
        <label>
          Ciudad
          <input value={ciudad} onChange={(e) => setCiudad(e.target.value)} required />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={enviando}>
          {enviando ? 'Procesando…' : 'Confirmar pedido'}
        </button>
      </form>
    </section>
  );
}
