import { lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { CarritoProvider } from './context/CarritoContext';
import { Layout } from './components/Layout';

// Code splitting por ruta: cada import() genera un chunk aparte que se
// descarga solo cuando el usuario navega a esa página. El bundle inicial
// queda con React, el router y el Layout.
const Inicio = lazy(() => import('./pages/Inicio'));
const Catalogo = lazy(() => import('./pages/Catalogo'));
const ProductoDetalle = lazy(() => import('./pages/ProductoDetalle'));
const Carrito = lazy(() => import('./pages/Carrito'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Registro = lazy(() => import('./pages/Registro'));
const Login = lazy(() => import('./pages/Login'));
const MisPedidos = lazy(() => import('./pages/MisPedidos'));
const Admin = lazy(() => import('./pages/Admin'));
const NoEncontrado = lazy(() => import('./pages/NoEncontrado'));

export default function App() {
  return (
    <CarritoProvider>
      <BrowserRouter>
        <Routes>
          {/* Layout es estático; Suspense vive dentro de él, alrededor de <Outlet />. */}
          <Route element={<Layout />}>
            <Route index element={<Inicio />} />
            <Route path="catalogo" element={<Catalogo />} />
            <Route path="producto/:id" element={<ProductoDetalle />} />
            <Route path="carrito" element={<Carrito />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="registro" element={<Registro />} />
            <Route path="login" element={<Login />} />
            <Route path="pedidos" element={<MisPedidos />} />
            <Route path="admin" element={<Admin />} />
            <Route path="*" element={<NoEncontrado />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </CarritoProvider>
  );
}
