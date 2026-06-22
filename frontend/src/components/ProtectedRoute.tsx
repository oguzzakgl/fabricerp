import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const ProtectedRoute: React.FC = () => {
  const { token, tenant, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-arka-plan-gri flex flex-col items-center justify-center gap-4">
        {/* Modern premium loader */}
        <div className="w-12 h-12 border-4 border-bilgi-mavisi/30 border-t-bilgi-mavisi rounded-full animate-spin"></div>
        <p className="text-on-surface font-semibold text-govde-metin">Yükleniyor...</p>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Kullanıcı giriş yapmış ama henüz bir firması (tenant) yoksa
  if (!tenant) {
    if (location.pathname !== '/onboarding') {
      return <Navigate to="/onboarding" replace />;
    }
  } else {
    // Firması olan kullanıcı /onboarding'e girmeye çalışırsa dashboard'a yönlendir
    if (location.pathname === '/onboarding') {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;
