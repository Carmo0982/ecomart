import { Suspense } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { LimiteErrorRuta } from './LimiteErrorRuta';
import { useCarrito } from '../context/CarritoContext';
import { modoDemo } from '../lib/config';

export function Layout() {
  const { cantidadTotal } = useCarrito();
  const { pathname } = useLocation();
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
        {/* La cabecera queda visible mientras se descarga el chunk de la ruta.
            key={pathname} reinicia el límite de error al navegar. */}
        <LimiteErrorRuta key={pathname}>
          <Suspense
            fallback={
              <p className="cargando" role="status" aria-live="polite">
                Cargando…
              </p>
            }
          >
            <Outlet />
          </Suspense>
        </LimiteErrorRuta>
      </main>
      <footer className="pie">EcoMart · Comercio sostenible</footer>
    </div>
  );
}
