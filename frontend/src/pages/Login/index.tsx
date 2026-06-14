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
      setLoading(true);
      const fetchUserData = async () => {
        try {
          // Set authentication header manually
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${queryToken}`;
          const response = await apiClient.get('/auth/me');
          login(queryToken, response.data.user, response.data.tenant);
          navigate('/dashboard');
        } catch (error) {
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
    } catch (err: any) {
      console.error('Login error:', err);
      const msg = err.response?.data?.message || 'Giriş yapılamadı. Lütfen e-posta ve şifrenizi kontrol edin.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-arka-plan-gri flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl border border-outline-variant">
        <div>
          {/* Header */}
          <div className="flex justify-center">
            <span className="material-symbols-outlined text-secondary text-5xl animate-pulse">
              layers
            </span>
          </div>
          <h2 className="mt-6 text-center text-ust-baslik-md font-bold text-on-surface">
            FabricERP Hesabınıza Giriş Yapın
          </h2>
          <p className="mt-2 text-center text-govde-metin text-on-surface-variant">
            Tekstil Üretim Kontrol Paneli
          </p>
        </div>

        {error && (
          <div className="bg-error-container border-l-4 border-error p-4 rounded-r-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="material-symbols-outlined text-error text-lg">error</span>
              </div>
              <div className="ml-3">
                <p className="text-sm text-on-error-container font-semibold">{error}</p>
              </div>
            </div>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md space-y-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
                E-posta Adresi
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">
                  mail
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-govde-metin focus:ring-2 focus:ring-bilgi-mavisi/30 focus:border-bilgi-mavisi outline-none transition-all"
                  placeholder="isim@fabrika.com"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
                Şifre
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">
                  lock
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-govde-metin focus:ring-2 focus:ring-bilgi-mavisi/30 focus:border-bilgi-mavisi outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg text-govde-metin font-bold text-on-secondary bg-secondary hover:bg-secondary/95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary active:scale-98 transition-all disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                'Giriş Yap'
              )}
            </button>
          </div>
        </form>

        <div className="text-center pt-4 border-t border-outline-variant">
          <p className="text-govde-metin text-on-surface-variant">
            Hesabınız yok mu?{' '}
            <a
              href="http://localhost:4000/register"
              className="font-bold text-secondary hover:underline transition-colors"
            >
              Hemen Kaydolun
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
