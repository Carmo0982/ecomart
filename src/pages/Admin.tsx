import { useEffect, useState } from 'react';
import { esAdmin, listarPedidos } from '../lib/api';
import type { Pedido } from '../lib/tipos';
import { claveMes, formatearPrecio } from '../lib/formato';

interface FilaMes {
  mes: string;
  cantidad: number;
  ventas: number;
}

/** Agrupa por mes sin lodash: un Map y un sort nativo. */
export function resumenPorMes(pedidos: Pedido[]): FilaMes[] {
  const meses = new Map<string, FilaMes>();
  for (const p of pedidos) {
    const mes = claveMes(p.creado_en);
    const fila = meses.get(mes) ?? { mes, cantidad: 0, ventas: 0 };
    fila.cantidad += 1;
    fila.ventas += Number(p.total);
    meses.set(mes, fila);
  }
  return [...meses.values()].sort((a, b) => b.mes.localeCompare(a.mes));
}

/**
 * Panel de administración (versión auditada).
 * Antes usaba un segundo cliente con la clave secreta de servicio (salta RLS) incrustada en el bundle.
 * Ahora usa el cliente normal: RLS devuelve todos los pedidos SOLO si
 * es_admin() es verdadero para el JWT del usuario. esAdmin() aquí solo
 * decide qué mostrar; la barrera real está en Postgres.
 */
export default function Admin() {
  const [estado, setEstado] = useState<'cargando' | 'denegado' | 'listo'>('cargando');
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

  useEffect(() => {
    let vigente = true;
    (async () => {
      if (!(await esAdmin())) {
        if (vigente) setEstado('denegado');
        return;
      }
      const lista = await listarPedidos();
      if (vigente) {
        setPedidos(lista);
        setEstado('listo');
      }
    })().catch(() => vigente && setEstado('denegado'));
    return () => {
      vigente = false;
    };
  }, []);

  if (estado === 'cargando') return <p>Verificando permisos…</p>;
  if (estado === 'denegado') return <p role="alert">No tienes permisos para ver esta página.</p>;

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
          {resumenPorMes(pedidos).map((f) => (
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
