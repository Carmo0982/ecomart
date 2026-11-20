import { useEffect, useMemo, useState } from 'react';
// lodash-es: módulos ES individuales → el bundler solo incluye debounce (~1 kB),
// no las ~300 funciones de lodash completo.
import { debounce } from 'lodash-es';
import { listarProductos } from '../lib/api';
import type { Producto } from '../lib/tipos';
import { TarjetaProducto } from '../components/TarjetaProducto';
import { etiquetaCategoria } from '../lib/formato';

export default function Catalogo() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('todas');
  const [error, setError] = useState<string | null>(null);

  const buscar = useMemo(
    () =>
      debounce((texto: string) => {
        listarProductos(texto)
          .then((p) => {
            setProductos(p);
            setError(null);
          })
          .catch((e: Error) => setError(e.message));
      }, 300),
    [],
  );

  useEffect(() => {
    buscar(busqueda);
  }, [busqueda, buscar]);

  useEffect(() => () => buscar.cancel(), [buscar]);

  const categorias = [...new Set(productos.map((p) => p.categoria))];
  const visibles = categoria === 'todas' ? productos : productos.filter((p) => p.categoria === categoria);

  return (
    <section>
      <h1>Catálogo</h1>
      <div className="filtros">
        <label>
          Buscar
          <input type="search" maxLength={60} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </label>
        <label>
          Categoría
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="todas">Todas</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {etiquetaCategoria(c)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="grilla">
        {visibles.map((p) => (
          <TarjetaProducto key={p.id} producto={p} />
        ))}
      </div>
    </section>
  );
}
