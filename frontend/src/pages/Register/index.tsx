import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../api/client';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !inviteCode) {
      setError('Lütfen tüm alanları doldurunuz.');
      return;
    }
    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await apiClient.post('/auth/register', {
        email,
        password,
        inviteCode,
      });

      const { token, user, tenant } = response.data;
      setSuccess(true);

      setTimeout(() => {
        login(token, user, tenant);
        navigate('/dashboard');
      }, 1500);
    } catch (err) {
      const error =
        err as { response?: { data?: { message?: string | string[] } } };
      console.error('Register error:', error);
      const msg =
        error.response?.data?.message ||
        'Kayıt olurken bir hata oluştu. Lütfen bilgilerinizi kontrol edin.';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
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
            FabricERP'e Ücretsiz Kaydolun
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

        {success && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="material-symbols-outlined text-green-600 text-lg">check_circle</span>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700 font-semibold">
                  Başarıyla kayıt olundu! ERP paneline yönlendiriliyorsunuz...
                </p>
              </div>
            </div>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md space-y-4">
            {/* E-posta */}
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

            {/* Şifre */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
                Şifre (Min 6 Karakter)
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">
                  lock
                </span>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-govde-metin focus:ring-2 focus:ring-bilgi-mavisi/30 focus:border-bilgi-mavisi outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Davetiye Kodu */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
                Davetiye Kodu
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">
                  key
                </span>
                <input
                  type="text"
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-govde-metin focus:ring-2 focus:ring-bilgi-mavisi/30 focus:border-bilgi-mavisi outline-none transition-all"
                  placeholder="Yöneticinizden aldığınız kod"
                />
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading || success}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg text-govde-metin font-bold text-on-secondary bg-secondary hover:bg-secondary/95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary active:scale-98 transition-all disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : success ? (
                'Yönlendiriliyor...'
              ) : (
                'Hesabı Oluştur & Başla'
              )}
            </button>
          </div>
        </form>

        <div className="text-center pt-4 border-t border-outline-variant">
          <p className="text-govde-metin text-on-surface-variant">
            Zaten hesabınız var mı?{' '}
            <a
              href="/login"
              onClick={(e) => { e.preventDefault(); navigate('/login'); }}
              className="font-bold text-secondary hover:underline transition-colors"
            >
              Giriş Yapın
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
