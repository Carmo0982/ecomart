import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { listarPedidos } from '../lib/api';
import type { Pedido } from '../lib/tipos';
import { formatearFecha, formatearPrecio } from '../lib/formato';

export default function MisPedidos() {
  const [params] = useSearchParams();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [error, setError] = useState<string | null>(null);
  const nuevo = params.get('nuevo');

  useEffect(() => {
    // RLS solo devuelve los pedidos del usuario autenticado.
    listarPedidos()
      .then(setPedidos)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <section>
      <h1>Mis pedidos</h1>
      {nuevo && <p role="status">¡Pedido {nuevo} creado!</p>}
      {error && <p role="alert">{error}</p>}
      {pedidos.length === 0 ? (
        <p>Aún no tienes pedidos.</p>
      ) : (
        <ul className="lista">
          {pedidos.map((p) => (
            <li key={p.id}>
              {formatearFecha(p.creado_en)} · {formatearPrecio(p.total)} · {p.estado}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
