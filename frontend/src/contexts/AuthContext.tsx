import React, { createContext, useContext, useState, useEffect } from 'react';
import apiClient from '../api/client';

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface Tenant {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxOffice?: string | null;
  taxNumber?: string | null;
  iban?: string | null;
  logoUrl?: string | null;
}

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: User, tenant: Tenant | null) => void;
  updateAuth: (token: string, user: User, tenant: Tenant) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        try {
          // Set authorization header manually for initial request just in case
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          const response = await apiClient.get('/auth/me');
          setUser(response.data.user);
          setTenant(response.data.tenant);
          setToken(storedToken);
        } catch (error) {
          console.error('Auth check failed:', error);
          logout();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = (newToken: string, newUser: User, newTenant: Tenant | null) => {
    localStorage.setItem('token', newToken);
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    setUser(newUser);
    setTenant(newTenant);
    setToken(newToken);
  };

  const updateAuth = (newToken: string, newUser: User, newTenant: Tenant) => {
    localStorage.setItem('token', newToken);
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    setUser(newUser);
    setTenant(newTenant);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete apiClient.defaults.headers.common['Authorization'];
    setUser(null);
    setTenant(null);
    setToken(null);
    // Clear other cached data if needed
  };

  return (
    <AuthContext.Provider value={{ user, tenant, token, loading, login, updateAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
