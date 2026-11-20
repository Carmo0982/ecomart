import { useEffect, useState } from 'react';
import _ from 'lodash';
import moment from 'moment';
import { listarTodosLosPedidos } from '../lib/api';
import type { Pedido } from '../lib/tipos';
import { formatearPrecio } from '../lib/formato';

export default function Admin() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

  useEffect(() => {
    listarTodosLosPedidos().then(setPedidos);
  }, []);

  const porMes = _.groupBy(pedidos, (p) => moment(p.creado_en).format('YYYY-MM'));
  const filas = _.orderBy(
    _.map(porMes, (lista, mes) => ({ mes, cantidad: lista.length, ventas: _.sumBy(lista, 'total') })),
    ['mes'],
    ['desc'],
  );

  return (
    <section>
      <h1>Panel de administración</h1>
      <table className="tabla">
        <thead>
          <tr>
            <th>Mes</th>
            <th>Pedidos</th>
            <th>Ventas</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.mes}>
              <td>{f.mes}</td>
              <td>{f.cantidad}</td>
              <td>{formatearPrecio(f.ventas)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
