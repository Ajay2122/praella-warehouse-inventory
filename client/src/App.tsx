import { Route, Routes } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Warehouses } from './pages/Warehouses';
import { Products } from './pages/Products';
import { Inventory } from './pages/Inventory';
import { PurchaseOrders } from './pages/PurchaseOrders';
import { SalesOrders } from './pages/SalesOrders';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/warehouses" element={<Warehouses />} />
          <Route path="/products" element={<Products />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/purchase-orders" element={<PurchaseOrders />} />
          <Route path="/sales-orders" element={<SalesOrders />} />
        </Route>
      </Route>
    </Routes>
  );
}
