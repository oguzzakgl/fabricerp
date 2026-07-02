import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../api/client';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const queryToken = queryParams.get('token');
    if (queryToken) {
      const fetchUserData = async () => {
        setLoading(true);
        try {
          // Store token in localStorage immediately so request interceptor and subsequent calls use it
          localStorage.setItem('token', queryToken);
          // Set authentication header manually just in case
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${queryToken}`;
          const response = await apiClient.get('/auth/me');
          login(queryToken, response.data.user, response.data.tenant);
          navigate('/dashboard');
        } catch (error) {
          // Clear token if verification fails
          localStorage.removeItem('token');
          delete apiClient.defaults.headers.common['Authorization'];
          console.error('Failed to login with URL token', error);
          setError('Oturum açılırken bir hata oluştu veya bağlantı süresi doldu.');
        } finally {
          setLoading(false);
        }
      };
      fetchUserData();
    }
  }, [navigate, login]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Lütfen e-posta ve şifrenizi giriniz.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await apiClient.post('/auth/login', {
        email,
        password,
      });

      const { token, user, tenant } = response.data;
      login(token, user, tenant);
      navigate('/dashboard');
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      console.error('Login error:', error);
      const msg =
        error.response?.data?.message ||
        'Giriş yapılamadı. Lütfen e-posta ve şifrenizi kontrol edin.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      style={{
        backgroundColor: '#0b0c10',
        backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(30, 96, 145, 0.15) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(82, 183, 136, 0.15) 0%, transparent 40%)',
        backgroundAttachment: 'fixed',
      }}
      className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8"
    >
      <div 
        style={{
          background: 'rgba(22, 28, 45, 0.4)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
        }}
        className="max-w-md w-full space-y-8 p-8 rounded-2xl"
      >
        <div>
          {/* Header */}
          <div className="flex justify-center">
            <span 
              style={{ color: '#52b788' }}
              className="material-symbols-outlined text-5xl animate-pulse"
            >
              layers
            </span>
          </div>
          <h2 
            style={{ fontFamily: "'Outfit', 'Inter', sans-serif", color: '#f8fafc' }}
            className="mt-6 text-center text-ust-baslik-md font-bold"
          >
            Fabricore Hesabınıza Giriş Yapın
          </h2>
          <p 
            style={{ color: '#94a3b8' }}
            className="mt-2 text-center text-govde-metin"
          >
            Tekstil Üretim Kontrol Paneli
          </p>
        </div>

        {error && (
          <div 
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderLeft: '4px solid #ef4444',
            }}
            className="p-4 rounded-r-lg"
          >
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="material-symbols-outlined text-lg" style={{ color: '#ef4444' }}>error</span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-semibold" style={{ color: '#f8fafc' }}>{error}</p>
              </div>
            </div>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md space-y-4">
            <div className="space-y-1">
              <label 
                htmlFor="login-email"
                style={{ color: '#94a3b8' }}
                className="text-[11px] font-bold uppercase tracking-wider block"
              >
                E-posta Adresi
              </label>
              <div className="relative">
                <span 
                  style={{ color: '#94a3b8' }}
                  className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base"
                >
                  mail
                </span>
                <input
                  type="email"
                  id="login-email"
                  name="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: '#f8fafc',
                  }}
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg text-govde-metin focus:border-[#52b788] focus:ring-1 focus:ring-[#52b788] outline-none transition-all placeholder:text-slate-500"
                  placeholder="isim@fabrika.com"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label 
                htmlFor="login-password"
                style={{ color: '#94a3b8' }}
                className="text-[11px] font-bold uppercase tracking-wider block"
              >
                Şifre
              </label>
              <div className="relative">
                <span 
                  style={{ color: '#94a3b8' }}
                  className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base"
                >
                  lock
                </span>
                <input
                  type="password"
                  id="login-password"
                  name="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: '#f8fafc',
                  }}
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg text-govde-metin focus:border-[#52b788] focus:ring-1 focus:ring-[#52b788] outline-none transition-all placeholder:text-slate-500"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              style={{
                backgroundColor: '#52b788',
                color: '#0b0c10',
                boxShadow: '0px 4px 15px rgba(82, 183, 136, 0.3)',
              }}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg text-govde-metin font-bold hover:brightness-105 active:scale-98 transition-all disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
              ) : (
                'Giriş Yap'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
