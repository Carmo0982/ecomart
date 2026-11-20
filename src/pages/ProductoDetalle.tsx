import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { obtenerProducto } from '../lib/api';
import type { Producto } from '../lib/tipos';
import { fechaEntregaEstimada, formatearPrecio, haceCuanto } from '../lib/formato';
import { useCarrito } from '../context/CarritoContext';

type Estado = { tipo: 'cargando' } | { tipo: 'listo'; producto: Producto } | { tipo: 'no-existe' } | { tipo: 'error' };

export default function ProductoDetalle() {
  const { id = '' } = useParams();
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });
  const { agregar } = useCarrito();

  useEffect(() => {
    let vigente = true;
    setEstado({ tipo: 'cargando' });
    obtenerProducto(id)
      .then((p) => vigente && setEstado(p ? { tipo: 'listo', producto: p } : { tipo: 'no-existe' }))
      .catch(() => vigente && setEstado({ tipo: 'error' }));
    return () => {
      vigente = false;
    };
  }, [id]);

  if (estado.tipo === 'cargando') return <p>Cargando producto…</p>;
  if (estado.tipo === 'error') return <p role="alert">No pudimos cargar el producto.</p>;
  if (estado.tipo === 'no-existe') {
    return (
      <p>
        Este producto no existe. <Link to="/catalogo">Volver al catálogo</Link>
      </p>
    );
  }

  const { producto } = estado;
  return (
    <article className="detalle">
      <img src={producto.imagen} alt={producto.nombre} width={400} height={300} />
      <div>
        <h1>{producto.nombre}</h1>
        <p className="precio">{formatearPrecio(producto.precio)}</p>
        {/* C1: texto plano (antes: dangerouslySetInnerHTML). React escapa el contenido;
            los saltos de línea se respetan con white-space: pre-line. */}
        <p className="descripcion">{producto.descripcion}</p>
        <p>Publicado {haceCuanto(producto.creado_en)}</p>
        <p>Si compras hoy, llega el {fechaEntregaEstimada()}.</p>
        <button type="button" onClick={() => agregar(producto)} disabled={producto.stock === 0}>
          Agregar al carrito
        </button>
      </div>
    </article>
  );
}
