import { NavLink, Outlet } from 'react-router';
import { useCarrito } from '../context/CarritoContext';
import { modoDemo } from '../lib/api';

export function Layout() {
  const { cantidadTotal } = useCarrito();
  return (
    <div className="app">
      <header className="cabecera">
        <NavLink to="/" className="marca">
          🌿 EcoMart
        </NavLink>
        <nav aria-label="Principal">
          <NavLink to="/catalogo">Catálogo</NavLink>
          <NavLink to="/carrito">Carrito ({cantidadTotal})</NavLink>
          <NavLink to="/pedidos">Mis pedidos</NavLink>
          <NavLink to="/login">Ingresar</NavLink>
          <NavLink to="/registro">Crear cuenta</NavLink>
        </nav>
      </header>
      {modoDemo && (
        <p className="aviso" role="status">
          Modo demostración: sin variables de Supabase se usa un catálogo local.
        </p>
      )}
      <main>
        <Outlet />
      </main>
      <footer className="pie">EcoMart · Comercio sostenible</footer>
    </div>
  );
}
