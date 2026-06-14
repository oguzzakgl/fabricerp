import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const ProtectedRoute: React.FC = () => {
  const { token, loading } = useAuth();

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

  return <Outlet />;
};

export default ProtectedRoute;
