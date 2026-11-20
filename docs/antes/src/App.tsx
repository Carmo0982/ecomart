import { BrowserRouter, Route, Routes } from 'react-router';
import { CarritoProvider } from './context/CarritoContext';
import { Layout } from './components/Layout';
// LÍNEA BASE: todas las rutas se importan de forma estática y viajan en el bundle inicial.
import Inicio from './pages/Inicio';
import Catalogo from './pages/Catalogo';
import ProductoDetalle from './pages/ProductoDetalle';
import Carrito from './pages/Carrito';
import Checkout from './pages/Checkout';
import Registro from './pages/Registro';
import Login from './pages/Login';
import MisPedidos from './pages/MisPedidos';
import Admin from './pages/Admin';
import NoEncontrado from './pages/NoEncontrado';

export default function App() {
  return (
    <CarritoProvider>
      <BrowserRouter>
        <Routes>
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
