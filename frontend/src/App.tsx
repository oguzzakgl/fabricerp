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
import Finance from './pages/Finance';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';


function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />

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
              <Route path="finance" element={<Finance />} />
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
