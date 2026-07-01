import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const ProtectedRoute: React.FC = () => {
  const { token, tenant, loading, user } = useAuth();
  const location = useLocation();

  React.useEffect(() => {
    if (!loading && !token) {
      window.location.href = import.meta.env.VITE_MARKETING_URL || 'http://localhost:4000';
    }
  }, [loading, token]);

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
    return null;
  }

  const isSuperAdmin = user && (user as { tenantId?: string | null }).tenantId === null;

  // Kullanıcı giriş yapmış ama henüz bir firması (tenant) yoksa ve süper admin değilse
  if (!tenant && !isSuperAdmin) {
    if (location.pathname !== '/onboarding') {
      return <Navigate to="/onboarding" replace />;
    }
  } else {
    // Firması olan veya süper admin olan kullanıcı /onboarding'e girmeye çalışırsa dashboard'a yönlendir
    if (location.pathname === '/onboarding') {
      return <Navigate to="/dashboard" replace />;
    }
  }

  // Süper admin ise ve /superadmin harici bir yere gitmeye çalışıyorsa /superadmin'e yönlendirebiliriz
  // Ancak isterse normal sayfaları da görebilir. Güvenlik için /superadmin rotasını sadece süper adminler açabilir
  if (location.pathname.startsWith('/superadmin') && !isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
