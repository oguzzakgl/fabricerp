import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../api/client';

interface Tenant {
  id: string;
  name: string;
  taxOffice: string | null;
  taxNumber: string | null;
  phone: string | null;
  email: string | null;
  createdAt: string;
  users: Array<{ id: string; name: string; email: string; role: string }>;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  tenant: { name: string } | null;
}

interface InviteCode {
  id: string;
  code: string;
  isUsed: boolean;
  usedByEmail: string | null;
  createdAt: string;
}

const SuperAdmin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'tenants' | 'users' | 'invites'>('tenants');
  const [stats, setStats] = useState({ tenants: 0, users: 0, invites: 0 });
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [invites, setInvites] = useState<InviteCode[]>([]);
  const [newInviteCode, setNewInviteCode] = useState('');
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, tenantsRes, usersRes, invitesRes] = await Promise.all([
        apiClient.get('/settings/super/stats'),
        apiClient.get('/settings/super/tenants'),
        apiClient.get('/settings/super/users'),
        apiClient.get('/settings/super/invites'),
      ]);
      setStats(statsRes.data);
      setTenants(tenantsRes.data || []);
      setUsers(usersRes.data || []);
      setInvites(invitesRes.data || []);
    } catch (error) {
      console.error('Veriler yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInviteCode.trim()) return;
    try {
      await apiClient.post('/settings/super/invites', { code: newInviteCode });
      alert('Davet kodu başarıyla oluşturuldu.');
      setNewInviteCode('');
      setInviteModalOpen(false);
      loadData();
    } catch (error: unknown) {
      console.error(error);
      const errMsg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(errMsg || 'Kod oluşturulurken hata oluştu.');
    }
  };

  const handleDeleteInvite = async (id: string) => {
    if (!confirm('Bu davet kodunu silmek istediğinize emin misiniz?')) return;
    try {
      await apiClient.delete(`/settings/super/invites/${id}`);
      alert('Davet kodu silindi.');
      loadData();
    } catch (error: unknown) {
      console.error(error);
      const errMsg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(errMsg || 'Kod silinirken hata oluştu.');
    }
  };

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* İstatistik Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-outline-variant flex items-center justify-between">
          <div>
            <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Kayıtlı Firmalar</p>
            <h3 className="text-3xl font-black text-on-surface mt-1">{stats.tenants}</h3>
          </div>
          <span className="material-symbols-outlined text-4xl text-primary bg-primary/10 p-3 rounded-xl">corporate_fare</span>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xs border border-outline-variant flex items-center justify-between">
          <div>
            <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Sistem Kullanıcıları</p>
            <h3 className="text-3xl font-black text-on-surface mt-1">{stats.users}</h3>
          </div>
          <span className="material-symbols-outlined text-4xl text-secondary bg-secondary/10 p-3 rounded-xl">groups</span>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xs border border-outline-variant flex items-center justify-between">
          <div>
            <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Davet Kodları</p>
            <h3 className="text-3xl font-black text-on-surface mt-1">{stats.invites}</h3>
          </div>
          <span className="material-symbols-outlined text-4xl text-bilgi-mavisi bg-bilgi-mavisi/10 p-3 rounded-xl">vpn_key</span>
        </div>
      </div>

      {/* Ana Canvas */}
      <div className="bg-white rounded-2xl border border-outline-variant shadow-xs overflow-hidden">
        {/* Sekme Seçimi */}
        <div className="flex justify-between items-center bg-surface-container-low border-b border-outline-variant px-6">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('tenants')}
              className={`px-5 py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'tenants'
                  ? 'border-secondary text-secondary font-black'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-base">corporate_fare</span>
              Müşteri Firmalar
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-5 py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'users'
                  ? 'border-secondary text-secondary font-black'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-base">groups</span>
              Kullanıcı Hesapları
            </button>
            <button
              onClick={() => setActiveTab('invites')}
              className={`px-5 py-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'invites'
                  ? 'border-secondary text-secondary font-black'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-base">vpn_key</span>
              Davet Kodları
            </button>
          </div>

          {activeTab === 'invites' && (
            <button
              onClick={() => setInviteModalOpen(true)}
              className="bg-secondary text-on-secondary px-4 py-2 rounded-xl text-xs font-bold hover:brightness-105 active:scale-95 flex items-center gap-1.5 transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Yeni Davet Kodu Üret
            </button>
          )}
        </div>

        <div className="p-6">
          {/* FİRMALAR SEKMESİ */}
          {activeTab === 'tenants' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                    <th className="py-3 px-4">Firma Adı</th>
                    <th className="py-3 px-4">İletişim E-posta</th>
                    <th className="py-3 px-4">Telefon</th>
                    <th className="py-3 px-4">Kayıt Tarihi</th>
                    <th className="py-3 px-4">Kullanıcı Sayısı</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant text-sm">
                  {tenants.map((t) => (
                    <tr key={t.id} className="hover:bg-arka-plan-gri/50 transition-colors">
                      <td className="py-4 px-4 font-bold text-on-surface">{t.name}</td>
                      <td className="py-4 px-4">{t.email || '-'}</td>
                      <td className="py-4 px-4">{t.phone || '-'}</td>
                      <td className="py-4 px-4 text-xs text-on-surface-variant">
                        {new Date(t.createdAt).toLocaleDateString('tr-TR')}
                      </td>
                      <td className="py-4 px-4">
                        <span className="bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-xs font-bold">
                          {t.users.length} Kullanıcı
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* KULLANICILAR SEKMESİ */}
          {activeTab === 'users' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                    <th className="py-3 px-4">Kullanıcı Adı</th>
                    <th className="py-3 px-4">E-posta</th>
                    <th className="py-3 px-4">Firma</th>
                    <th className="py-3 px-4">Rol</th>
                    <th className="py-3 px-4">Kayıt Tarihi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant text-sm">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-arka-plan-gri/50 transition-colors">
                      <td className="py-4 px-4 font-bold text-on-surface">{u.name}</td>
                      <td className="py-4 px-4 font-mono text-xs">{u.email}</td>
                      <td className="py-4 px-4 font-semibold text-primary">{u.tenant?.name || 'Sistem Yöneticisi'}</td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          u.role === 'ADMIN' ? 'bg-secondary/15 text-secondary' : 'bg-bilgi-mavisi/15 text-bilgi-mavisi'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-xs text-on-surface-variant">
                        {new Date(u.createdAt).toLocaleDateString('tr-TR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* DAVET KODLARI SEKMESİ */}
          {activeTab === 'invites' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                    <th className="py-3 px-4">Davet Kodu</th>
                    <th className="py-3 px-4">Durum</th>
                    <th className="py-3 px-4">Kullanan E-posta</th>
                    <th className="py-3 px-4">Oluşturulma Tarihi</th>
                    <th className="py-3 px-4 text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant text-sm">
                  {invites.map((i) => (
                    <tr key={i.id} className="hover:bg-arka-plan-gri/50 transition-colors">
                      <td className="py-4 px-4 font-mono font-bold text-on-surface tracking-wider">{i.code}</td>
                      <td className="py-4 px-4">
                        {i.isUsed ? (
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold">Kullanıldı</span>
                        ) : (
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold">Aktif / Kullanılabilir</span>
                        )}
                      </td>
                      <td className="py-4 px-4 font-mono text-xs">{i.usedByEmail || '-'}</td>
                      <td className="py-4 px-4 text-xs text-on-surface-variant">
                        {new Date(i.createdAt).toLocaleDateString('tr-TR')}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={() => handleDeleteInvite(i.id)}
                          className="text-red-500 hover:text-red-700 font-bold text-xs"
                        >
                          Kodu Sil
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* DAVET KODU MODALI */}
      {inviteModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl overflow-hidden border border-outline-variant">
            <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h5 className="font-bold text-sm text-on-surface">Yeni Davet Kodu Üret</h5>
              <button
                className="material-symbols-outlined text-outline hover:text-on-surface"
                onClick={() => setInviteModalOpen(false)}
              >
                close
              </button>
            </div>
            <form onSubmit={handleCreateInvite} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase block">Davet Kodu</label>
                <input
                  type="text"
                  placeholder="Örn: BORA-TEKSTIL-2026"
                  value={newInviteCode}
                  onChange={(e) => setNewInviteCode(e.target.value)}
                  className="w-full px-3 py-2 bg-arka-plan-gri border border-outline-variant rounded font-mono uppercase tracking-wider text-sm focus:ring-1 focus:ring-bilgi-mavisi outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-on-surface-variant hover:bg-arka-plan-gri rounded-lg border border-transparent hover:border-outline-variant transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="bg-secondary text-on-secondary px-5 py-2 text-xs font-bold rounded-lg hover:brightness-105 active:scale-95 transition-all"
                >
                  Oluştur
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
