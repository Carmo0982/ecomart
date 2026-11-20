import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { listarProductos } from '../lib/api';
import type { Producto } from '../lib/tipos';
import { TarjetaProducto } from '../components/TarjetaProducto';

export default function Inicio() {
  const [destacados, setDestacados] = useState<Producto[]>([]);

  useEffect(() => {
    listarProductos().then((p) => setDestacados(p.slice(0, 3)));
  }, []);

  return (
    <section>
      <div className="hero">
        <h1>Compra sostenible, sin complicaciones</h1>
        <p>Productos reutilizables, biodegradables y con huella de carbono declarada.</p>
        <Link className="boton" to="/catalogo">
          Ver catálogo
        </Link>
      </div>
      <h2>Novedades</h2>
      <div className="grilla">
        {destacados.map((p) => (
          <TarjetaProducto key={p.id} producto={p} />
        ))}
      </div>
    </section>
  );
}
