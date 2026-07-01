import React, { useState, useEffect, useCallback } from 'react';
import { superAdminApi, type InviteCode } from '../../api/superadmin';
import { Modal } from 'antd';

const Invites: React.FC = () => {
  const [invites, setInvites] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('STARTER');
  const [submitting, setSubmitting] = useState(false);
  const [planFilter, setPlanFilter] = useState<'ALL' | 'STARTER' | 'PRO' | 'ENTERPRISE'>('ALL');

  const filteredInvites = invites.filter(invite => {
    if (planFilter === 'ALL') return true;
    return invite.plan === planFilter;
  });

  const generateRandomCode = (plan: string) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomPart = '';
    for (let i = 0; i < 6; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    let prefix = 'START';
    if (plan === 'PRO') prefix = 'PRO';
    if (plan === 'ENTERPRISE') prefix = 'ENT';
    return `${prefix}-${randomPart}`;
  };

  const openModal = () => {
    setSelectedPlan('STARTER');
    setNewCode(generateRandomCode('STARTER'));
    setModalOpen(true);
  };

  const handlePlanChange = (plan: string) => {
    setSelectedPlan(plan);
    setNewCode(generateRandomCode(plan));
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await superAdminApi.getInvites();
      setInvites(res.data || []);
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) return;
    setSubmitting(true);
    try {
      await superAdminApi.createInvite(newCode, selectedPlan);
      alert('Davet kodu oluşturuldu.'); setModalOpen(false); setNewCode(''); setSelectedPlan('STARTER'); load();
    } catch (e: unknown) {
      alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Hata.');
    } finally { setSubmitting(false); }
  };

  const handleDelete = (id: string) => {
     Modal.confirm({
      title: 'Davet Kodunu Sil',
      content: 'Bu kodu silmek istediğinize emin misiniz?',
      okText: 'Evet, Sil',
      okType: 'danger',
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await superAdminApi.deleteInvite(id); load();
        } catch (e: unknown) {
          alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Hata.');
        }
      }
    });
  };

  if (loading) return (
    <div className="flex h-[70vh] items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={openModal}
          className="bg-secondary text-on-secondary px-4 py-2 rounded-xl text-sm font-bold hover:brightness-105 active:scale-95 flex items-center gap-2 transition-all shadow-sm">
          <span className="material-symbols-outlined text-sm">add</span>
          Yeni Davet Kodu Üret
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
          Tümü ({invites.length})
        </button>
        <button
          onClick={() => setPlanFilter('STARTER')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            planFilter === 'STARTER'
              ? 'bg-secondary text-on-secondary shadow-sm'
              : 'bg-surface hover:bg-surface-container-low text-on-surface-variant border border-outline-variant'
          }`}
        >
          Atölye (Starter) ({invites.filter(i => i.plan === 'STARTER').length})
        </button>
        <button
          onClick={() => setPlanFilter('PRO')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            planFilter === 'PRO'
              ? 'bg-secondary text-on-secondary shadow-sm'
              : 'bg-surface hover:bg-surface-container-low text-on-surface-variant border border-outline-variant'
          }`}
        >
          Fabrika (Pro) ({invites.filter(i => i.plan === 'PRO').length})
        </button>
        <button
          onClick={() => setPlanFilter('ENTERPRISE')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            planFilter === 'ENTERPRISE'
              ? 'bg-secondary text-on-secondary shadow-sm'
              : 'bg-surface hover:bg-surface-container-low text-on-surface-variant border border-outline-variant'
          }`}
        >
          Kurumsal (Enterprise) ({invites.filter(i => i.plan === 'ENTERPRISE').length})
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-outline-variant shadow-xs overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-outline-variant text-[11px] font-bold text-on-surface-variant uppercase tracking-wider bg-surface-container-low">
              <th className="py-3 px-4">Davet Kodu</th>
              <th className="py-3 px-4">Paket / Plan</th>
              <th className="py-3 px-4">Durum</th>
              <th className="py-3 px-4">Kullanan E-posta</th>
              <th className="py-3 px-4">Oluşturulma Tarihi</th>
              <th className="py-3 px-4 text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant text-sm">
            {filteredInvites.map(i => (
              <tr key={i.id} className="hover:bg-arka-plan-gri/50 transition-colors">
                <td className="py-4 px-4 font-mono font-bold text-on-surface tracking-wider">{i.code}</td>
                <td className="py-4 px-4">
                  {i.plan === 'STARTER' && <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-xs font-semibold">Atölye (Starter)</span>}
                  {i.plan === 'PRO' && <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-xs font-semibold">Fabrika (Pro)</span>}
                  {i.plan === 'ENTERPRISE' && <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded text-xs font-semibold">Kurumsal (Enterprise)</span>}
                </td>
                <td className="py-4 px-4">
                  {i.isUsed
                    ? <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold">Kullanıldı</span>
                    : <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold">Aktif</span>
                  }
                </td>
                <td className="py-4 px-4 font-mono text-xs text-on-surface-variant">{i.usedAt ? new Date(i.usedAt).toLocaleDateString('tr-TR') : '-'}</td>
                <td className="py-4 px-4 text-xs text-on-surface-variant">{new Date(i.createdAt).toLocaleDateString('tr-TR')}</td>
                <td className="py-4 px-4 text-right">
                  <button onClick={() => handleDelete(i.id)} className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1 ml-auto">
                    <span className="material-symbols-outlined text-sm">delete</span>
                    Sil
                  </button>
                </td>
              </tr>
            ))}
            {filteredInvites.length === 0 && (
              <tr><td colSpan={6} className="py-10 text-center text-sm text-on-surface-variant">Davet kodu bulunamadı.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl border border-outline-variant overflow-hidden">
            <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h5 className="font-bold text-sm">Yeni Davet Kodu Üret</h5>
              <button className="material-symbols-outlined text-outline hover:text-on-surface" onClick={() => setModalOpen(false)}>close</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase block">Davet Kodu *</label>
                <div className="flex gap-2">
                  <input type="text" value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase())}
                    placeholder="Örn: START-A8B9C2"
                    className="flex-1 px-3 py-2 bg-arka-plan-gri border border-outline-variant rounded font-mono uppercase tracking-wider text-sm outline-none focus:ring-1 focus:ring-bilgi-mavisi" />
                  <button type="button" onClick={() => setNewCode(generateRandomCode(selectedPlan))}
                    className="px-3 bg-surface-container border border-outline-variant rounded flex items-center justify-center hover:bg-surface-container-high transition-colors active:scale-95 text-on-surface"
                    title="Yenile / Başka Kod Üret">
                    <span className="material-symbols-outlined text-base">refresh</span>
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase block">Atanacak Paket / Plan *</label>
                <select value={selectedPlan} onChange={e => handlePlanChange(e.target.value)}
                  className="w-full px-3 py-2 bg-arka-plan-gri border border-outline-variant rounded text-sm outline-none focus:ring-1 focus:ring-bilgi-mavisi">
                  <option value="STARTER">Atölye (Starter) - Fotoğrafsız</option>
                  <option value="PRO">Fabrika (Pro) - OCR Dahil</option>
                  <option value="ENTERPRISE">Kurumsal (Enterprise)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-xs text-on-surface-variant hover:bg-arka-plan-gri rounded-lg border border-outline-variant">İptal</button>
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

export default Invites;
