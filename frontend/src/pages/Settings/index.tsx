import React, { useState, useEffect } from 'react';
import { Modal } from 'antd';
import apiClient from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';

const Settings: React.FC = () => {
  const { user } = useAuth();
  const [settingsTab, setSettingsTab] = useState<'info' | 'team' | 'appearance'>('info');
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string; role: string; createdAt: string }>>([]);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('USER');
  const [userFormOpen, setUserFormOpen] = useState(false);
  const [taxRate, setTaxRate] = useState(20);
  const [companyName, setCompanyName] = useState('');
  const [taxOffice, setTaxOffice] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [iban, setIban] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const fetchSettings = async () => {
    try {
      const response = await apiClient.get('/settings');
      if (response.data) {
        if (response.data.taxRate !== undefined) setTaxRate(response.data.taxRate);
        if (response.data.companyName !== undefined) setCompanyName(response.data.companyName);
        if (response.data.taxOffice !== undefined) setTaxOffice(response.data.taxOffice);
        if (response.data.taxNumber !== undefined) setTaxNumber(response.data.taxNumber);
        if (response.data.phone !== undefined) setPhone(response.data.phone);
        if (response.data.email !== undefined) setEmail(response.data.email);
        if (response.data.address !== undefined) setAddress(response.data.address);
        if (response.data.iban !== undefined) setIban(response.data.iban);
        if (response.data.geminiApiKey !== undefined) setGeminiApiKey(response.data.geminiApiKey);
      }
    } catch (error) {
      console.error('Ayarlar yüklenemedi:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await apiClient.get('/settings/users');
      setUsers(response.data || []);
    } catch (error) {
      console.error('Ekip listesi yüklenemedi:', error);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      alert('Lütfen tüm alanları doldurunuz.');
      return;
    }
    try {
      await apiClient.post('/settings/users', {
        name: newUserName,
        email: newUserEmail,
        password: newUserPassword,
        role: newUserRole,
      });
      alert('Kullanıcı başarıyla eklendi.');
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('USER');
      setUserFormOpen(false);
      fetchUsers();
    } catch (error: unknown) {
      console.error(error);
      const errMsg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(errMsg || 'Kullanıcı eklenirken hata oluştu.');
    }
  };

  const handleDeleteUser = (id: string) => {
    Modal.confirm({
      title: 'Kullanıcıyı Sil',
      content: 'Bu kullanıcıyı silmek istediğinize emin misiniz?',
      okText: 'Evet, Sil',
      okType: 'danger',
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await apiClient.delete(`/settings/users/${id}`);
          alert('Kullanıcı silindi.');
          fetchUsers();
        } catch (error: unknown) {
          console.error(error);
          const errMsg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
          alert(errMsg || 'Kullanıcı silinirken hata oluştu.');
        }
      }
    });
  };

  const handleSaveSettings = async () => {
    try {
      await apiClient.post('/settings', {
        taxRate,
        companyName,
        taxOffice,
        taxNumber,
        phone,
        email,
        address,
        iban,
        geminiApiKey,
      });
      window.dispatchEvent(new Event('settingsChanged'));
      alert('Ayarlar başarıyla kaydedildi.');
    } catch (error) {
      console.error('Ayarlar kaydedilirken hata oluştu:', error);
      alert('Ayarlar kaydedilirken hata oluştu.');
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSettings();
      fetchUsers();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-3xl text-secondary">settings</span>
        <div>
          <h3 className="text-ust-baslik-md font-bold text-on-surface">Sistem Ayarları</h3>
          <p className="text-xs text-on-surface-variant">Firma bilgilerinizi, ekibinizi ve görünüm tercihinizi yönetin.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-outline-variant shadow-sm overflow-hidden">
        {/* Sekmeler */}
        <div className="flex border-b border-outline-variant bg-surface-container-low px-4 overflow-x-auto whitespace-nowrap scrollbar-none">
          <button
            onClick={() => setSettingsTab('info')}
            className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
              settingsTab === 'info'
                ? 'border-secondary text-secondary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Firma Bilgileri & OCR
          </button>
          <button
            onClick={() => setSettingsTab('team')}
            className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
              settingsTab === 'team'
                ? 'border-secondary text-secondary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Ekip Üyeleri & Yetkiler
          </button>
          <button
            onClick={() => setSettingsTab('appearance')}
            className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
              settingsTab === 'appearance'
                ? 'border-secondary text-secondary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Görünüm & Tema
          </button>
        </div>

        <div className="p-6 bg-surface-container-lowest">
          {settingsTab === 'info' && (
            <div className="space-y-6">
              {/* VAT Settings */}
              <div className="space-y-2 max-w-xs">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">Varsayılan KDV Oranı (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number(e.target.value))}
                    className="w-full pl-3 pr-8 py-2 bg-surface-container-low border border-outline-variant rounded text-on-surface focus:ring-1 focus:ring-secondary outline-none font-semibold"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant text-sm">%</span>
                </div>
                <p className="text-xs text-on-surface-variant">Bu oran, sipariş oluşturma ve fatura kesme işlemlerinde varsayılan olarak uygulanacaktır.</p>
              </div>

              <hr className="border-outline-variant" />

              {/* Company Invoicing Settings */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-base">receipt_long</span>
                  <h5 className="font-bold text-sm text-on-surface">Fatura Bilgileri</h5>
                </div>
                <p className="text-xs text-on-surface-variant">Faturaların üzerinde görüntülenecek kurumsal bilgilerinizi buradan girebilirsiniz.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">Firma Resmi Unvanı</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Örn: FabricERP Tekstil San. Tic. A.Ş."
                      className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-on-surface focus:ring-1 focus:ring-secondary outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">Vergi Dairesi</label>
                    <input
                      type="text"
                      value={taxOffice}
                      onChange={(e) => setTaxOffice(e.target.value)}
                      placeholder="Örn: Merter V.D."
                      className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-on-surface focus:ring-1 focus:ring-secondary outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">Vergi Numarası</label>
                    <input
                      type="text"
                      value={taxNumber}
                      onChange={(e) => setTaxNumber(e.target.value)}
                      placeholder="10 haneli numara"
                      className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-on-surface focus:ring-1 focus:ring-secondary outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">İletişim Telefonu</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Örn: 0212 XXXXXXX"
                      className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-on-surface focus:ring-1 focus:ring-secondary outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">Kurumsal E-posta</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="info@sirketiniz.com"
                      className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-on-surface focus:ring-1 focus:ring-secondary outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">Banka IBAN Adresi</label>
                    <input
                      type="text"
                      value={iban}
                      onChange={(e) => setIban(e.target.value)}
                      placeholder="TRXX XXXX XXXX XXXX XXXX XX"
                      className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-on-surface focus:ring-1 focus:ring-secondary outline-none"
                    />
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">Firma Adresi</label>
                    <textarea
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Firma açık adresi..."
                      rows={2}
                      className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-on-surface focus:ring-1 focus:ring-secondary outline-none resize-none"
                    />
                  </div>
                </div>
              </div>

              <hr className="border-outline-variant" />

              {/* AI & OCR Settings */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-base">psychology</span>
                  <h5 className="font-bold text-sm text-on-surface">Gemini Yapay Zeka & OCR Entegrasyonu</h5>
                </div>
                <p className="text-xs text-on-surface-variant">Etiket okuma (OCR) ve veri analiz özellikleri için Gemini API anahtarınızı tanımlayın.</p>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">Gemini API Key</label>
                  <input
                    type="password"
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-on-surface focus:ring-1 focus:ring-secondary outline-none font-mono"
                  />
                  <p className="text-[10px] text-on-surface-variant">API anahtarınız şifrelenmiş olarak güvenli bir şekilde saklanır.</p>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-outline-variant">
                <button
                  onClick={handleSaveSettings}
                  className="bg-secondary text-on-secondary px-6 py-2 rounded-lg font-bold hover:brightness-105 active:scale-95 transition-all flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">save</span>
                  Değişiklikleri Kaydet
                </button>
              </div>
            </div>
          )}

          {settingsTab === 'team' && (
            <div className="space-y-5">
              <div className="flex justify-between items-center">
                <h5 className="font-bold text-sm text-on-surface">Ekip Üyeleri Listesi</h5>
                {!userFormOpen && (
                  <button
                    onClick={() => setUserFormOpen(true)}
                    className="bg-secondary text-on-secondary px-3 py-1.5 text-xs font-bold rounded-lg hover:brightness-105 active:scale-95 transition-all flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-xs">add</span>
                    Yeni Ekip Üyesi Ekle
                  </button>
                )}
              </div>

              {userFormOpen && (
                <form onSubmit={handleCreateUser} className="p-4 bg-surface rounded-xl border border-outline-variant space-y-4 transition-all">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-on-surface-variant uppercase block">Ad Soyad</label>
                      <input
                        type="text"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        placeholder="Örn: Ahmet Yılmaz"
                        className="w-full px-3 py-1.5 bg-surface-container-low border border-outline-variant rounded text-xs outline-none focus:ring-1 focus:ring-secondary"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-on-surface-variant uppercase block">E-posta Adresi</label>
                      <input
                        type="email"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        placeholder="ahmet@sirketiniz.com"
                        className="w-full px-3 py-1.5 bg-surface-container-low border border-outline-variant rounded text-xs outline-none focus:ring-1 focus:ring-secondary"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-on-surface-variant uppercase block">Şifre</label>
                      <input
                        type="password"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        placeholder="En az 6 karakter"
                        className="w-full px-3 py-1.5 bg-surface-container-low border border-outline-variant rounded text-xs outline-none focus:ring-1 focus:ring-secondary"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-on-surface-variant uppercase block">Yetki Rolü</label>
                      <select
                        value={newUserRole}
                        onChange={(e) => setNewUserRole(e.target.value)}
                        className="w-full px-3 py-1.5 bg-surface-container-low border border-outline-variant rounded text-xs outline-none focus:ring-1 focus:ring-secondary"
                      >
                        <option value="USER">User (Yalnızca Görüntüleme & Giriş)</option>
                        <option value="ADMIN">Admin (Tam Yetki)</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setUserFormOpen(false)}
                      className="px-3 py-1.5 text-xs font-bold text-on-surface-variant hover:bg-surface-container-low rounded border border-transparent hover:border-outline-variant transition-all"
                    >
                      Vazgeç
                    </button>
                    <button
                      type="submit"
                      className="bg-secondary text-on-secondary px-4 py-1.5 text-xs font-bold rounded hover:brightness-105 active:scale-95 transition-all"
                    >
                      Kullanıcı Ekle
                    </button>
                  </div>
                </form>
              )}

              <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-xs">
                {users.length === 0 ? (
                  <div className="p-6 text-center text-xs text-on-surface-variant">Ekip üyesi bulunmamaktadır.</div>
                ) : (
                  <div className="divide-y divide-outline-variant">
                    {users.map((u) => (
                      <div key={u.id} className="p-4 flex items-center justify-between hover:bg-surface-container-low transition-colors">
                        <div>
                          <p className="font-bold text-xs text-on-surface">{u.name}</p>
                          <p className="text-[11px] text-on-surface-variant font-mono">{u.email}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            u.role === 'ADMIN' ? 'bg-secondary/15 text-secondary' : 'bg-blue-500/15 text-blue-400'
                          }`}>
                            {u.role}
                          </span>
                          {user?.id !== u.id && (
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              className="text-red-500 hover:text-red-700 material-symbols-outlined text-base p-1 hover:bg-red-500/10 rounded transition-colors"
                              title="Kullanıcıyı Sil"
                            >
                              delete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {settingsTab === 'appearance' && (
            <div className="space-y-4">
              <div className="p-4 bg-surface rounded-xl border border-outline-variant space-y-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-base">palette</span>
                  <h5 className="font-bold text-sm text-on-surface">Görünüm Teması</h5>
                </div>
                <p className="text-xs text-on-surface-variant">
                  Uygulama genelinde kullanılacak renk temasını seçebilirsiniz.
                </p>
                <div className="grid grid-cols-2 gap-4 pt-2 max-w-md">
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`flex flex-col items-center gap-2 p-6 rounded-xl border transition-all ${
                      theme === 'light'
                        ? 'border-secondary bg-secondary/5 font-bold text-secondary'
                        : 'border-outline-variant hover:bg-surface-container-low text-on-surface-variant'
                    }`}
                  >
                    <span className="material-symbols-outlined text-3xl">light_mode</span>
                    <span className="text-sm font-semibold">Aydınlık Mod</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`flex flex-col items-center gap-2 p-6 rounded-xl border transition-all ${
                      theme === 'dark'
                        ? 'border-secondary bg-secondary/5 font-bold text-secondary'
                        : 'border-outline-variant hover:bg-surface-container-low text-on-surface-variant'
                    }`}
                  >
                    <span className="material-symbols-outlined text-3xl">dark_mode</span>
                    <span className="text-sm font-semibold">Karanlık Mod</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
