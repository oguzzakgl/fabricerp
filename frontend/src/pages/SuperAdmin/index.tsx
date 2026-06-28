import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { superAdminApi, type SuperAdminStats, type Tenant } from '../../api/superadmin';

const SuperAdmin: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<SuperAdminStats>({ tenants: 0, users: 0, invites: 0 });
  const [recentTenants, setRecentTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ tenantName: '', adminEmail: '', adminPassword: '' });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, tenantsRes] = await Promise.all([
        superAdminApi.getStats(),
        superAdminApi.getTenants(),
      ]);
      setStats(statsRes.data);
      setRecentTenants((tenantsRes.data || []).slice(0, 5));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      await load();
    };
    void fetchData();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tenantName.trim() || !form.adminEmail.trim() || !form.adminPassword.trim()) {
      alert('Tüm alanları doldurunuz.'); return;
    }
    setSubmitting(true);
    try {
      await superAdminApi.createTenant(form);
      setModalOpen(false);
      setForm({ tenantName: '', adminEmail: '', adminPassword: '' });
      load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || 'Hata oluştu.');
    } finally { setSubmitting(false); }
  };

  if (loading) return (
    <div className="flex h-[70vh] items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* İstatistik Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div onClick={() => navigate('/superadmin/tenants')}
          className="bg-white p-5 rounded-2xl shadow-xs border border-outline-variant flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow">
          <div>
            <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Kayıtlı Firmalar</p>
            <h3 className="text-3xl font-black text-on-surface mt-1">{stats.tenants}</h3>
          </div>
          <span className="material-symbols-outlined text-4xl text-primary bg-primary/10 p-3 rounded-xl">corporate_fare</span>
        </div>
        <div onClick={() => navigate('/superadmin/users')}
          className="bg-white p-5 rounded-2xl shadow-xs border border-outline-variant flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow">
          <div>
            <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Sistem Kullanıcıları</p>
            <h3 className="text-3xl font-black text-on-surface mt-1">{stats.users}</h3>
          </div>
          <span className="material-symbols-outlined text-4xl text-secondary bg-secondary/10 p-3 rounded-xl">groups</span>
        </div>
        <div onClick={() => navigate('/superadmin/invites')}
          className="bg-white p-5 rounded-2xl shadow-xs border border-outline-variant flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow">
          <div>
            <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Davet Kodları</p>
            <h3 className="text-3xl font-black text-on-surface mt-1">{stats.invites}</h3>
          </div>
          <span className="material-symbols-outlined text-4xl text-bilgi-mavisi bg-bilgi-mavisi/10 p-3 rounded-xl">vpn_key</span>
        </div>
      </div>

      {/* Son Firmalar */}
      <div className="bg-white rounded-2xl border border-outline-variant shadow-xs overflow-hidden">
        <div className="flex justify-between items-center px-6 py-4 border-b border-outline-variant bg-surface-container-low">
          <h3 className="font-bold text-sm text-on-surface">Son Kayıt Olan Firmalar</h3>
          <div className="flex gap-2">
            <button onClick={() => navigate('/superadmin/tenants')} className="text-secondary text-xs font-bold hover:underline">Tümünü Gör →</button>
            <button onClick={() => setModalOpen(true)}
              className="bg-secondary text-on-secondary px-3 py-1.5 rounded-lg text-xs font-bold hover:brightness-105 flex items-center gap-1.5 transition-all">
              <span className="material-symbols-outlined text-xs">add</span>
              Yeni Şirket
            </button>
          </div>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-outline-variant text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
              <th className="py-3 px-4">Firma Adı</th>
              <th className="py-3 px-4">E-posta</th>
              <th className="py-3 px-4">Kayıt Tarihi</th>
              <th className="py-3 px-4">Kullanıcı</th>
              <th className="py-3 px-4 text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant text-sm">
            {recentTenants.map(t => (
              <tr key={t.id} className="hover:bg-arka-plan-gri/50 transition-colors">
                <td className="py-4 px-4 font-bold text-on-surface">{t.name}</td>
                <td className="py-4 px-4 text-on-surface-variant">{t.email || '-'}</td>
                <td className="py-4 px-4 text-xs text-on-surface-variant">{new Date(t.createdAt).toLocaleDateString('tr-TR')}</td>
                <td className="py-4 px-4">
                  <span className="bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-xs font-bold">{t.users.length}</span>
                </td>
                <td className="py-4 px-4 text-right">
                  <button onClick={() => navigate(`/superadmin/tenants/${t.id}`)}
                    className="text-secondary hover:text-secondary/80 text-xs font-bold flex items-center gap-1 ml-auto">
                    Detay <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                </td>
              </tr>
            ))}
            {recentTenants.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-sm text-on-surface-variant">Henüz firma yok.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Yeni Şirket Modal */}
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
                  placeholder="Örn: Bora Tekstil A.Ş."
                  className="w-full px-3 py-2 bg-arka-plan-gri border border-outline-variant rounded text-sm outline-none focus:ring-1 focus:ring-bilgi-mavisi" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase block">Admin E-posta *</label>
                <input type="email" value={form.adminEmail} onChange={e => setForm(f => ({ ...f, adminEmail: e.target.value }))}
                  placeholder="admin@sirket.com"
                  className="w-full px-3 py-2 bg-arka-plan-gri border border-outline-variant rounded text-sm outline-none focus:ring-1 focus:ring-bilgi-mavisi" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase block">Admin Şifre *</label>
                <input type="password" value={form.adminPassword} onChange={e => setForm(f => ({ ...f, adminPassword: e.target.value }))}
                  placeholder="En az 6 karakter"
                  className="w-full px-3 py-2 bg-arka-plan-gri border border-outline-variant rounded text-sm outline-none focus:ring-1 focus:ring-bilgi-mavisi" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-xs font-bold text-on-surface-variant hover:bg-arka-plan-gri rounded-lg border border-outline-variant">İptal</button>
                <button type="submit" disabled={submitting} className="bg-secondary text-on-secondary px-5 py-2 text-xs font-bold rounded-lg hover:brightness-105 disabled:opacity-50">
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

export default SuperAdmin;
