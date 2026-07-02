import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import './App.css';

// Statik importlar ile tüm sayfaları baştan yüklüyoruz (Sayfa geçişleri anında gerçekleşir)
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import YarnStocks from './pages/YarnStocks';
import Fabrics from './pages/Fabrics';
import Orders from './pages/Orders';
import Invoices from './pages/Invoices';
import Waybills from './pages/Waybills';
import Finance from './pages/Finance';
import Onboarding from './pages/Onboarding';
import SuperAdmin from './pages/SuperAdmin';
import Tenants from './pages/SuperAdmin/Tenants';
import TenantDetail from './pages/SuperAdmin/TenantDetail';
import SuperUsers from './pages/SuperAdmin/Users';
import Invites from './pages/SuperAdmin/Invites';
import Settings from './pages/Settings';
import Register from './pages/Register';

import Login from './pages/Login';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected App Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="accounts" element={<Accounts />} />
              <Route path="yarn-stocks" element={<YarnStocks />} />
              <Route path="fabrics" element={<Fabrics />} />
              <Route path="orders" element={<Orders />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="waybills" element={<Waybills />} />
              <Route path="finance" element={<Finance />} />
              <Route path="settings" element={<Settings />} />
              <Route path="superadmin" element={<SuperAdmin />} />
              <Route path="superadmin/tenants" element={<Tenants />} />
              <Route path="superadmin/tenants/:id" element={<TenantDetail />} />
              <Route path="superadmin/users" element={<SuperUsers />} />
              <Route path="superadmin/invites" element={<Invites />} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
