import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../api/client';

const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const { updateAuth, logout } = useAuth();
  const [name, setName] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !tenantName.trim()) {
      setError('Lütfen tüm alanları doldurunuz.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await apiClient.post('/auth/onboarding', {
        name: name.trim(),
        tenantName: tenantName.trim(),
      });

      const { token, user: updatedUser, tenant } = response.data;
      updateAuth(token, updatedUser, tenant);
      
      // Onboarding tamamlandıktan sonra paneli aç
      navigate('/dashboard');
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      console.error('Onboarding error:', error);
      const msg =
        error.response?.data?.message ||
        'Kurulum tamamlanamadı. Lütfen daha sonra tekrar deneyin.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f172a] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-purple-500/10 via-transparent to-transparent pointer-events-none" />

      <div className="max-w-md w-full space-y-8 bg-slate-900/60 backdrop-blur-xl p-8 rounded-2xl border border-slate-800 shadow-2xl relative z-10">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="material-symbols-outlined text-white text-3xl animate-pulse">
                rocket_launch
              </span>
            </div>
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            NovaERP'ye Hoş Geldiniz
          </h2>
          <p className="mt-3 text-sm text-slate-400">
            Fabrikanızı dijitalleştirmek için son adım. Lütfen profilinizi ve şirketinizi tanımlayın.
          </p>
        </div>

        {error && (
          <div className="bg-rose-950/50 border border-rose-800/80 p-4 rounded-xl">
            <div className="flex items-center">
              <span className="material-symbols-outlined text-rose-400 text-lg mr-2">error</span>
              <p className="text-xs text-rose-200 font-semibold">{error}</p>
            </div>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Adınız Soyadınız
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-base">
                  person
                </span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-950/40 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                  placeholder="Ahmet Yılmaz"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Fabrika / Şirket Ünvanı
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-base">
                  domain
                </span>
                <input
                  type="text"
                  required
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-950/40 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all"
                  placeholder="Bora Tekstil San. Tic. A.Ş."
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg text-sm font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 active:scale-98 transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/25"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                'Kurulumu Tamamla'
              )}
            </button>
            
            <button
              type="button"
              onClick={logout}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-400 transition-colors py-2"
            >
              Farklı bir hesapla giriş yap
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Onboarding;
