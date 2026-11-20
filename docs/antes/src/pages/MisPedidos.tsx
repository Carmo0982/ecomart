import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import _ from 'lodash';
import { listarMisPedidos } from '../lib/api';
import type { Pedido } from '../lib/tipos';
import { formatearFecha, formatearPrecio } from '../lib/formato';

export default function MisPedidos() {
  const [params] = useSearchParams();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

  useEffect(() => {
    listarMisPedidos().then((p) => setPedidos(_.orderBy(p, ['creado_en'], ['desc'])));
  }, []);

  return (
    <section>
      <h1>Mis pedidos</h1>
      {params.get('nuevo') && <p role="status">¡Pedido {params.get('nuevo')} creado!</p>}
      {_.isEmpty(pedidos) ? (
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
