import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { superAdminApi, type Tenant, type TenantUser } from '../../api/superadmin';
import { Modal } from 'antd';

const TenantDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [pwdModal, setPwdModal] = useState<TenantUser | null>(null);
  const [emailModal, setEmailModal] = useState<TenantUser | null>(null);
  const [addModal, setAddModal] = useState(false);
  const [newPwd, setNewPwd] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', role: 'ADMIN' });
  const [submitting, setSubmitting] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [prompt, setPrompt] = useState('');
  const [savingApi, setSavingApi] = useState(false);

  const [prevId, setPrevId] = useState(id);
  if (id !== prevId) {
    setPrevId(id);
    setLoading(true);
  }

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await superAdminApi.getTenant(id);
      setTenant(res.data);
      setApiKey(res.data?.geminiApiKey || '');
      setPrompt(res.data?.geminiPrompt || '');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

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

  const handleSaveApiKey = async () => {
    if (!id) return;
    setSavingApi(true);
    try {
      await superAdminApi.updateTenantSettings(id, { geminiApiKey: apiKey, geminiPrompt: prompt });
      alert('Ayarlar kaydedildi.');
    } catch (e: unknown) {
      alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Hata.');
    } finally { setSavingApi(false); }
  };

  const handleChangePwd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdModal || newPwd.length < 6) { alert('Şifre en az 6 karakter olmalıdır.'); return; }
    setSubmitting(true);
    try {
      await superAdminApi.updateUserPassword(pwdModal.id, newPwd);
      alert('Şifre güncellendi.');
      setPwdModal(null); setNewPwd('');
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
      alert('E-posta güncellendi.');
      setEmailModal(null); setNewEmail(''); load();
    } catch (e: unknown) {
      alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Hata.');
    } finally { setSubmitting(false); }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !addForm.name || !addForm.email || !addForm.password) { alert('Tüm alanları doldurun.'); return; }
    setSubmitting(true);
    try {
      await superAdminApi.addUserToTenant(id, addForm);
      alert('Kullanıcı eklendi.'); setAddModal(false);
      setAddForm({ name: '', email: '', password: '', role: 'ADMIN' }); load();
    } catch (e: unknown) {
      alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Hata.');
    } finally { setSubmitting(false); }
  };

  const handleDeleteUser = (userId: string) => {
    Modal.confirm({
      title: 'Kullanıcıyı Sil',
      content: 'Bu kullanıcıyı silmek istediğinize emin misiniz?',
      okText: 'Evet, Sil',
      okType: 'danger',
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await superAdminApi.deleteUser(userId);
          load();
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

  if (loading) return (
    <div className="flex h-[70vh] items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary"></div>
    </div>
  );
  if (!tenant) return <div className="p-8 text-center text-on-surface-variant">Firma bulunamadı.</div>;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/superadmin/tenants')} className="flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface transition-colors">
        <span className="material-symbols-outlined text-base">arrow_back</span>
        Müşteri Firmalar
      </button>

      {/* Üst Kısım: Firma Bilgileri (Sol) + API Ayarları (Sağ) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sol: Firma Bilgileri */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-outline-variant shadow-xs p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-secondary text-2xl">corporate_fare</span>
              </div>
              <div>
                <h2 className="text-lg font-black text-on-surface">{tenant.name}</h2>
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">{tenant.users.length} Kullanıcı</span>
              </div>
            </div>
            <div className="space-y-3 pt-2 border-t border-outline-variant">
              {[
                { label: 'E-posta', value: tenant.email, icon: 'email' },
                { label: 'Telefon', value: tenant.phone, icon: 'phone' },
                { label: 'Adres', value: tenant.address, icon: 'location_on' },
                { label: 'Vergi Dairesi', value: tenant.taxOffice, icon: 'account_balance' },
                { label: 'Vergi No', value: tenant.taxNumber, icon: 'badge' },
              ].map(({ label, value, icon }) => (
                <div key={label} className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-sm text-on-surface-variant mt-0.5">{icon}</span>
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase">{label}</p>
                    <p className="text-sm text-on-surface">{value || '-'}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-sm text-on-surface-variant mt-0.5">calendar_today</span>
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase">Kayıt Tarihi</p>
                  <p className="text-sm text-on-surface">{new Date(tenant.createdAt).toLocaleDateString('tr-TR')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sağ: API Ayarları */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-outline-variant shadow-xs p-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-base">psychology</span>
              <h4 className="font-bold text-sm text-on-surface">API Ayarları</h4>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase block">Gemini API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="AIzaSyD-..."
                  className="w-full px-3 py-2 bg-arka-plan-gri border border-outline-variant rounded text-sm font-mono outline-none focus:ring-1 focus:ring-bilgi-mavisi"
                />
                <p className="text-[10px] text-on-surface-variant">OCR özelliği için Google Gemini API anahtarı</p>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase block">Özel OCR Promptu (Talimatı)</label>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder={`ŞABLON:\n- fabricType (Kumaş Türü): [Asıl kumaş cinsini bul]\n- colorCode (Renk Kodu): [1-13 arası tam sayı]\n- lengthM (Metre / Uzunluk): [Uzunluk değeri]\n- netWeightKg (Net Ağırlık / Kg): [Net ağırlık değeri]\n- quality (Kalite Sınıfı): [Genellikle 1]\n- barcodeNumber (Barkod / Top No): [Barkod veya Top No]\n\nÖrn: 1. fabricType: 'KUMAŞ ADI' yerine 'KALİTE' başlığının yanındakini oku...`}
                  rows={10}
                  className="w-full px-3 py-2 bg-arka-plan-gri border border-outline-variant rounded text-sm outline-none focus:ring-1 focus:ring-bilgi-mavisi resize-y"
                />
                <p className="text-[10px] text-on-surface-variant">Müşterinin etiketlerine özel OCR promptunu buradan düzenleyebilirsiniz. Boş bırakılırsa varsayılan prompt kullanılır.</p>
              </div>
              <button
                onClick={handleSaveApiKey}
                disabled={savingApi}
                className="w-full bg-secondary text-on-secondary py-2 rounded-lg text-xs font-bold hover:brightness-105 transition-all disabled:opacity-50"
              >
                {savingApi ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Alt Kısım: Kullanıcılar */}
      <div className="bg-white rounded-2xl border border-outline-variant shadow-xs overflow-hidden">
        <div className="flex justify-between items-center px-6 py-4 border-b border-outline-variant bg-surface-container-low">
          <h3 className="font-bold text-sm text-on-surface">Kullanıcılar</h3>
          <button onClick={() => setAddModal(true)} className="bg-secondary text-on-secondary px-3 py-1.5 rounded-lg text-xs font-bold hover:brightness-105 flex items-center gap-1.5 transition-all">
            <span className="material-symbols-outlined text-xs">add</span>
            Kullanıcı Ekle
          </button>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-outline-variant text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
              <th className="py-3 px-4">Ad Soyad</th>
              <th className="py-3 px-4">E-posta</th>
              <th className="py-3 px-4">Rol</th>
              <th className="py-3 px-4">Tarih</th>
              <th className="py-3 px-4 text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant text-sm">
            {tenant.users.map(u => (
              <tr key={u.id} className="hover:bg-arka-plan-gri/50 transition-colors">
                <td className="py-3 px-4 font-semibold text-on-surface">{u.name || '-'}</td>
                <td className="py-3 px-4 font-mono text-xs text-on-surface-variant">{u.email}</td>
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
                    <button onClick={() => handleDeleteUser(u.id)} title="Sil"
                      className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 hover:text-red-600 transition-colors">
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {tenant.users.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-sm text-on-surface-variant">Kullanıcı bulunamadı.</td></tr>
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

      {/* Kullanıcı Ekle Modal */}
      {addModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl border border-outline-variant overflow-hidden">
            <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h5 className="font-bold text-sm">Kullanıcı Ekle</h5>
              <button className="material-symbols-outlined text-outline" onClick={() => setAddModal(false)}>close</button>
            </div>
            <form onSubmit={handleAddUser} className="p-6 space-y-3">
              {[
                { label: 'Ad Soyad *', key: 'name', type: 'text', placeholder: 'Ahmet Yılmaz' },
                { label: 'E-posta *', key: 'email', type: 'email', placeholder: 'ahmet@sirket.com' },
                { label: 'Şifre *', key: 'password', type: 'password', placeholder: 'En az 6 karakter' },
              ].map(f => (
                <div key={f.key} className="space-y-1">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase block">{f.label}</label>
                  <input type={f.type} value={addForm[f.key as keyof typeof addForm]} placeholder={f.placeholder}
                    onChange={e => setAddForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2 bg-arka-plan-gri border border-outline-variant rounded text-sm outline-none focus:ring-1 focus:ring-bilgi-mavisi" />
                </div>
              ))}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase block">Rol</label>
                <select value={addForm.role} onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 bg-arka-plan-gri border border-outline-variant rounded text-sm outline-none">
                  <option value="ADMIN">Admin (Yönetici)</option>
                  <option value="USER">Personel (Standart)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setAddModal(false)} className="px-4 py-2 text-xs text-on-surface-variant hover:bg-arka-plan-gri rounded-lg border border-outline-variant">İptal</button>
                <button type="submit" disabled={submitting} className="bg-secondary text-on-secondary px-5 py-2 text-xs font-bold rounded-lg hover:brightness-105 disabled:opacity-50">Ekle</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantDetail;
