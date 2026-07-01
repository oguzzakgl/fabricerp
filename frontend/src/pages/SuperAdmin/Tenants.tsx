import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { superAdminApi, type Tenant } from '../../api/superadmin';

const Tenants: React.FC = () => {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ tenantName: '', adminEmail: '', adminPassword: '' });
  const [submitting, setSubmitting] = useState(false);
  const [planFilter, setPlanFilter] = useState<'ALL' | 'STARTER' | 'PRO' | 'ENTERPRISE'>('ALL');

  const loadTenants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await superAdminApi.getTenants();
      setTenants(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      if (active) {
        await loadTenants();
      }
    };
    void fetchData();
    return () => {
      active = false;
    };
  }, [loadTenants]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tenantName.trim() || !form.adminEmail.trim() || !form.adminPassword.trim()) {
      alert('Tüm alanları doldurunuz.');
      return;
    }
    setSubmitting(true);
    try {
      await superAdminApi.createTenant(form);
      setModalOpen(false);
      setForm({ tenantName: '', adminEmail: '', adminPassword: '' });
      loadTenants();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || 'Hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = tenants.filter(t => {
    if (planFilter !== 'ALL' && t.plan !== planFilter) return false;
    return t.name.toLowerCase().includes(search.toLowerCase()) ||
           (t.email || '').toLowerCase().includes(search.toLowerCase());
  });

  if (loading) return (
    <div className="flex h-[70vh] items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="relative w-64">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">search</span>
          <input
            className="w-full pl-9 pr-3 py-2 bg-white border border-outline-variant rounded-lg text-sm focus:ring-1 focus:ring-bilgi-mavisi outline-none"
            placeholder="Firma ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="bg-secondary text-on-secondary px-4 py-2 rounded-xl text-sm font-bold hover:brightness-105 active:scale-95 flex items-center gap-2 transition-all shadow-sm"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Yeni Şirket Oluştur
        </button>
      </div>

      <div className="flex gap-2 border-b border-outline-variant pb-2 overflow-x-auto whitespace-nowrap scrollbar-thin">
        <button
          onClick={() => setPlanFilter('ALL')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            planFilter === 'ALL'
              ? 'bg-secondary text-on-secondary shadow-sm'
              : 'bg-surface hover:bg-surface-container-low text-on-surface-variant border border-outline-variant'
          }`}
        >
          Tümü ({tenants.length})
        </button>
        <button
          onClick={() => setPlanFilter('STARTER')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            planFilter === 'STARTER'
              ? 'bg-secondary text-on-secondary shadow-sm'
              : 'bg-surface hover:bg-surface-container-low text-on-surface-variant border border-outline-variant'
          }`}
        >
          Atölye (Starter) ({tenants.filter(t => t.plan === 'STARTER').length})
        </button>
        <button
          onClick={() => setPlanFilter('PRO')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            planFilter === 'PRO'
              ? 'bg-secondary text-on-secondary shadow-sm'
              : 'bg-surface hover:bg-surface-container-low text-on-surface-variant border border-outline-variant'
          }`}
        >
          Fabrika (Pro) ({tenants.filter(t => t.plan === 'PRO').length})
        </button>
        <button
          onClick={() => setPlanFilter('ENTERPRISE')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            planFilter === 'ENTERPRISE'
              ? 'bg-secondary text-on-secondary shadow-sm'
              : 'bg-surface hover:bg-surface-container-low text-on-surface-variant border border-outline-variant'
          }`}
        >
          Kurumsal (Enterprise) ({tenants.filter(t => t.plan === 'ENTERPRISE').length})
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-outline-variant shadow-xs overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-outline-variant text-[11px] font-bold text-on-surface-variant uppercase tracking-wider bg-surface-container-low">
              <th className="py-3 px-4">Firma Adı</th>
              <th className="py-3 px-4">E-posta</th>
              <th className="py-3 px-4">Telefon</th>
              <th className="py-3 px-4">Paket / Plan</th>
              <th className="py-3 px-4">Kayıt Tarihi</th>
              <th className="py-3 px-4">Kullanıcı</th>
              <th className="py-3 px-4 text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant text-sm">
            {filtered.map(t => (
              <tr key={t.id} className="hover:bg-arka-plan-gri/50 transition-colors">
                <td className="py-4 px-4 font-bold text-on-surface">{t.name}</td>
                <td className="py-4 px-4 text-on-surface-variant">{t.email || '-'}</td>
                <td className="py-4 px-4 text-on-surface-variant">{t.phone || '-'}</td>
                <td className="py-4 px-4">
                  {t.plan === 'STARTER' && <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-xs font-semibold">Atölye (Starter)</span>}
                  {t.plan === 'PRO' && <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-xs font-semibold">Fabrika (Pro)</span>}
                  {t.plan === 'ENTERPRISE' && <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded text-xs font-semibold">Kurumsal (Enterprise)</span>}
                </td>
                <td className="py-4 px-4 text-xs text-on-surface-variant">{new Date(t.createdAt).toLocaleDateString('tr-TR')}</td>
                <td className="py-4 px-4">
                  <span className="bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-xs font-bold">{t.users.length}</span>
                </td>
                <td className="py-4 px-4 text-right">
                  <button
                    onClick={() => navigate(`/superadmin/tenants/${t.id}`)}
                    className="text-secondary hover:text-secondary/80 text-xs font-bold flex items-center gap-1 ml-auto"
                  >
                    Detay Gör
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="py-10 text-center text-sm text-on-surface-variant">Firma bulunamadı.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl border border-outline-variant overflow-hidden">
            <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h5 className="font-bold text-sm text-on-surface">Yeni Şirket Oluştur</h5>
              <button className="material-symbols-outlined text-outline hover:text-on-surface" onClick={() => setModalOpen(false)}>close</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase block">Şirket Adı *</label>
                <input type="text" value={form.tenantName} onChange={e => setForm(f => ({ ...f, tenantName: e.target.value }))}
                  placeholder="Örn: Bora Tekstil A.Ş." className="w-full px-3 py-2 bg-arka-plan-gri border border-outline-variant rounded text-sm outline-none focus:ring-1 focus:ring-bilgi-mavisi" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase block">Admin E-posta *</label>
                <input type="email" value={form.adminEmail} onChange={e => setForm(f => ({ ...f, adminEmail: e.target.value }))}
                  placeholder="admin@sirket.com" className="w-full px-3 py-2 bg-arka-plan-gri border border-outline-variant rounded text-sm outline-none focus:ring-1 focus:ring-bilgi-mavisi" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase block">Admin Şifre *</label>
                <input type="password" value={form.adminPassword} onChange={e => setForm(f => ({ ...f, adminPassword: e.target.value }))}
                  placeholder="En az 6 karakter" className="w-full px-3 py-2 bg-arka-plan-gri border border-outline-variant rounded text-sm outline-none focus:ring-1 focus:ring-bilgi-mavisi" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-xs font-bold text-on-surface-variant hover:bg-arka-plan-gri rounded-lg border border-transparent hover:border-outline-variant transition-colors">İptal</button>
                <button type="submit" disabled={submitting} className="bg-secondary text-on-secondary px-5 py-2 text-xs font-bold rounded-lg hover:brightness-105 active:scale-95 transition-all disabled:opacity-50">
                  {submitting ? 'Oluşturuluyor...' : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tenants;
