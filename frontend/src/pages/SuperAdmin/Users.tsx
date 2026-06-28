import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from 'antd';
import { superAdminApi, type SuperAdminUser } from '../../api/superadmin';

const Users: React.FC = () => {
  const [users, setUsers] = useState<SuperAdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pwdModal, setPwdModal] = useState<SuperAdminUser | null>(null);
  const [emailModal, setEmailModal] = useState<SuperAdminUser | null>(null);
  const [newPwd, setNewPwd] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await superAdminApi.getUsers();
      setUsers(res.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      if (active) {
        await load();
      }
    };
    void fetchData();
    return () => {
      active = false;
    };
  }, [load]);

  const handleChangePwd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdModal || newPwd.length < 6) { alert('Şifre en az 6 karakter.'); return; }
    setSubmitting(true);
    try {
      await superAdminApi.updateUserPassword(pwdModal.id, newPwd);
      alert('Şifre güncellendi.'); setPwdModal(null); setNewPwd('');
    } catch (e: unknown) {
      alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Hata.');
    } finally { setSubmitting(false); }
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailModal || !newEmail.includes('@')) { alert('Geçerli e-posta giriniz.'); return; }
    setSubmitting(true);
    try {
      await superAdminApi.updateUserEmail(emailModal.id, newEmail);
      alert('E-posta güncellendi.'); setEmailModal(null); setNewEmail(''); load();
    } catch (e: unknown) {
      alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Hata.');
    } finally { setSubmitting(false); }
  };

  const handleDelete = (userId: string) => {
    Modal.confirm({
      title: 'Kullanıcıyı Sil',
      content: 'Bu kullanıcıyı silmek istediğinize emin misiniz?',
      okText: 'Evet, Sil',
      okType: 'danger',
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await superAdminApi.deleteUser(userId); load();
        } catch (e: unknown) {
          alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Hata.');
        }
      }
    });
  };

  const roleBadge = (role: string) => {
    const map: Record<string, string> = { ADMIN: 'bg-secondary/15 text-secondary', USER: 'bg-bilgi-mavisi/15 text-bilgi-mavisi' };
    return map[role] || 'bg-gray-100 text-gray-600';
  };

  const filtered = users.filter(u =>
    (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.tenant?.name || '').toLowerCase().includes(search.toLowerCase())
  );

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
          <input className="w-full pl-9 pr-3 py-2 bg-white border border-outline-variant rounded-lg text-sm focus:ring-1 focus:ring-bilgi-mavisi outline-none"
            placeholder="Kullanıcı ara..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <p className="text-sm text-on-surface-variant">{filtered.length} kullanıcı</p>
      </div>

      <div className="bg-white rounded-2xl border border-outline-variant shadow-xs overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-outline-variant text-[11px] font-bold text-on-surface-variant uppercase tracking-wider bg-surface-container-low">
              <th className="py-3 px-4">Ad Soyad</th>
              <th className="py-3 px-4">E-posta</th>
              <th className="py-3 px-4">Firma</th>
              <th className="py-3 px-4">Rol</th>
              <th className="py-3 px-4">Kayıt Tarihi</th>
              <th className="py-3 px-4 text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant text-sm">
            {filtered.map(u => (
              <tr key={u.id} className="hover:bg-arka-plan-gri/50 transition-colors">
                <td className="py-3 px-4 font-semibold text-on-surface">{u.name || '-'}</td>
                <td className="py-3 px-4 font-mono text-xs text-on-surface-variant">{u.email}</td>
                <td className="py-3 px-4 font-semibold text-primary text-xs">{u.tenant?.name || 'Sistem Yöneticisi'}</td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${roleBadge(u.role)}`}>{u.role}</span>
                </td>
                <td className="py-3 px-4 text-xs text-on-surface-variant">{new Date(u.createdAt).toLocaleDateString('tr-TR')}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={() => { setPwdModal(u); setNewPwd(''); }} title="Şifre Değiştir"
                      className="p-1.5 hover:bg-arka-plan-gri rounded-lg text-on-surface-variant hover:text-on-surface transition-colors">
                      <span className="material-symbols-outlined text-base">key</span>
                    </button>
                    <button onClick={() => { setEmailModal(u); setNewEmail(u.email); }} title="E-posta Değiştir"
                      className="p-1.5 hover:bg-arka-plan-gri rounded-lg text-on-surface-variant hover:text-on-surface transition-colors">
                      <span className="material-symbols-outlined text-base">mail</span>
                    </button>
                    <button onClick={() => handleDelete(u.id)} title="Sil"
                      className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 hover:text-red-600 transition-colors">
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="py-10 text-center text-sm text-on-surface-variant">Kullanıcı bulunamadı.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Şifre Modal */}
      {pwdModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl border border-outline-variant overflow-hidden">
            <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h5 className="font-bold text-sm">Şifre Değiştir — <span className="text-secondary">{pwdModal.email}</span></h5>
              <button className="material-symbols-outlined text-outline" onClick={() => setPwdModal(null)}>close</button>
            </div>
            <form onSubmit={handleChangePwd} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase block">Yeni Şifre *</label>
                <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="En az 6 karakter"
                  className="w-full px-3 py-2 bg-arka-plan-gri border border-outline-variant rounded text-sm outline-none focus:ring-1 focus:ring-bilgi-mavisi" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPwdModal(null)} className="px-4 py-2 text-xs text-on-surface-variant hover:bg-arka-plan-gri rounded-lg border border-outline-variant">İptal</button>
                <button type="submit" disabled={submitting} className="bg-secondary text-on-secondary px-5 py-2 text-xs font-bold rounded-lg hover:brightness-105 disabled:opacity-50">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* E-posta Modal */}
      {emailModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl border border-outline-variant overflow-hidden">
            <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h5 className="font-bold text-sm">E-posta Değiştir — <span className="text-secondary">{emailModal.email}</span></h5>
              <button className="material-symbols-outlined text-outline" onClick={() => setEmailModal(null)}>close</button>
            </div>
            <form onSubmit={handleChangeEmail} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase block">Yeni E-posta *</label>
                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-arka-plan-gri border border-outline-variant rounded text-sm outline-none focus:ring-1 focus:ring-bilgi-mavisi" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEmailModal(null)} className="px-4 py-2 text-xs text-on-surface-variant hover:bg-arka-plan-gri rounded-lg border border-outline-variant">İptal</button>
                <button type="submit" disabled={submitting} className="bg-secondary text-on-secondary px-5 py-2 text-xs font-bold rounded-lg hover:brightness-105 disabled:opacity-50">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
