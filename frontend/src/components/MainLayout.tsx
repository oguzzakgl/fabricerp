import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import apiClient from '../api/client';
import { useAuth } from '../contexts/AuthContext';

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, tenant, logout } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [taxRate, setTaxRate] = useState(20);
  const [companyName, setCompanyName] = useState('');
  const [taxOffice, setTaxOffice] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [iban, setIban] = useState('');

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
      }
    } catch (error) {
      console.error('Ayarlar yüklenemedi:', error);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const menuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: '/accounts', label: 'Cari Hesaplar', icon: 'group' },
    { path: '/yarn-stocks', label: 'İplik Envanteri', icon: 'inventory_2' },
    { path: '/fabrics', label: 'Kumaş Envanteri', icon: 'layers' },
    { path: '/orders', label: 'Sipariş Yönetimi', icon: 'shopping_cart' },
    { path: '/invoices', label: 'Faturalandırma', icon: 'receipt_long' },
    { path: '/finance', label: 'Finans', icon: 'account_balance_wallet' },
  ];

  const handleGlobalSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const q = globalSearch.trim().toLowerCase();
    if (!q) return;
    // Route based on keyword hint
    if (/^(c-|m-|s-)|cari|müşteri|tedarikçi/i.test(q)) {
      navigate(`/accounts`);
    } else if (/^[0-9]{8,}|barkod|top/i.test(q)) {
      navigate(`/fabrics`);
    } else if (/^lot|iplik|^ne/i.test(q)) {
      navigate(`/yarn-stocks`);
    } else if (/^sip|sipariş/i.test(q)) {
      navigate(`/orders`);
    } else if (/^fat|fatura/i.test(q)) {
      navigate(`/invoices`);
    } else if (/çek|senet|finans/i.test(q)) {
      navigate(`/finance`);
    } else {
      navigate(`/accounts`);
    }
    setGlobalSearch('');
  };

  const getHeaderTitle = () => {
    switch (location.pathname) {
      case '/dashboard': return 'Dashboard Genel Bakış';
      case '/accounts': return 'Cari Hesap Yönetimi';
      case '/yarn-stocks': return 'İplik Envanteri';
      case '/fabrics': return 'Kumaş Envanteri';
      case '/orders': return 'Sipariş Yönetimi';
      case '/invoices': return 'Faturalandırma';
      case '/finance': return 'Finans (Çek/Senet)';
      default: return 'Tekstil ERP';
    }
  };

  return (
    <div className="min-h-screen bg-arka-plan-gri text-on-surface">
      {/* Sidebar Navigation */}
      <aside className="bg-sidebar-koyu h-screen w-64 fixed left-0 top-0 border-r border-outline-variant flex flex-col py-kenar-payi z-50">
        <div className="px-kenar-payi mb-8">
          <h1 className="text-on-secondary-container text-ust-baslik-md font-ust-baslik-md font-bold tracking-tight truncate" title={tenant?.name || 'Tekstil ERP'}>
            {tenant?.name || 'Tekstil ERP'}
          </h1>
          <p className="text-on-secondary-container opacity-60 text-kucuk-not font-kucuk-not">Üretim Kontrol Paneli</p>
        </div>
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto hide-scrollbar">
          {menuItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200 text-left ${
                  isActive
                    ? 'bg-secondary text-on-secondary font-semibold shadow-md'
                    : 'text-on-secondary-container opacity-70 hover:opacity-100 hover:bg-primary-container'
                }`}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span className="text-govde-metin font-govde-metin">{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="px-6 mt-auto pt-6 border-t border-white/10 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <img
              alt="Kullanıcı Profili"
              className="w-10 h-10 rounded-full border-2 border-bilgi-mavisi"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAsh1ouTOHIthx7so7nTAJc-S1ZbihLgoAUFm10GWRgG_8OhLqXI1GodNfyYK_kxZH1EMkonw8cX2Otqa2OY-RuzIxFXUZ_DDdIR1SnBtKYawCfOabtBCk0Rwu5JNezyx9nX8KtuQiZTAbPRumTldF47d4vGw_4nphesyYwfFSInK2qGhOISa8NvlZ3eZTmQDt9Xd1P9BsuoSv8tCGa0iN3IIW3BJJSpOTrh5L8po-9dqm_SXIR1Wnu4reN_9oRmzMBx8ZGGo8dVBVE"
            />
            <div className="min-w-0 flex-1">
              <p className="text-on-secondary-container text-govde-metin font-semibold truncate" title={user?.name || user?.email}>
                {user?.name || user?.email || 'Kullanıcı'}
              </p>
              <p className="text-on-secondary-container opacity-50 text-kucuk-not truncate">{user?.role || 'ADMIN'}</p>
            </div>
          </div>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white transition-all text-sm font-semibold"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            Çıkış Yap
          </button>
        </div>
      </aside>

      {/* Main Content Canvas */}
      <main className="ml-64 min-h-screen">
        {/* Top Nav Bar */}
        <header className="fixed top-0 right-0 w-[calc(100%-16rem)] z-40 bg-surface-container-lowest border-b border-outline-variant h-16 px-kenar-payi flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-4 flex-1">
            <h2 className="text-alt-baslik font-alt-baslik font-bold text-on-surface">{getHeaderTitle()}</h2>
            <div className="relative w-96">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
              <input
                className="w-full pl-10 pr-4 py-2 bg-surface-container-low border border-outline-variant rounded text-govde-metin focus:ring-1 focus:ring-bilgi-mavisi outline-none"
                placeholder="Barkod, Lot No veya Cari Ara... (Enter ile git)"
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onKeyDown={handleGlobalSearch}
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-surface-container-low rounded-full transition-colors relative" title="Bildirimler (Yakında)">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button 
              onClick={() => setSettingsOpen(true)}
              className="p-2 hover:bg-surface-container-low rounded-full transition-colors"
            >
              <span className="material-symbols-outlined">settings</span>
            </button>
            <button className="p-2 hover:bg-surface-container-low rounded-full transition-colors">
              <span className="material-symbols-outlined">help_outline</span>
            </button>
          </div>
        </header>

        <div className="pt-24 px-kenar-payi pb-kenar-payi">
          <Outlet />
        </div>
      </main>

      {/* SETTINGS MODAL */}
      {settingsOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-outline-variant flex flex-col">
            <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h4 className="text-alt-baslik font-alt-baslik font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">settings</span>
                Sistem Ayarları
              </h4>
              <button
                className="material-symbols-outlined text-outline hover:text-on-surface"
                onClick={() => setSettingsOpen(false)}
              >
                close
              </button>
            </div>
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* VAT Settings */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">Varsayılan KDV Oranı (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number(e.target.value))}
                    className="w-full pl-3 pr-8 py-2 bg-surface-container-low border border-outline-variant rounded text-govde-metin focus:ring-1 focus:ring-bilgi-mavisi outline-none font-semibold"
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
                  <h5 className="font-bold text-sm text-on-surface">Fatura Bilgileri (Kurulum için Gerekli)</h5>
                </div>
                <p className="text-xs text-on-surface-variant">Faturaların üzerinde görüntülenecek kurumsal bilgilerinizi buradan girebilirsiniz.</p>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">Firma Resmi Unvanı</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Örn: Bora Tekstil San. ve Tic. Ltd. Şti."
                    className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-govde-metin focus:ring-1 focus:ring-bilgi-mavisi outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">Vergi Dairesi</label>
                    <input
                      type="text"
                      value={taxOffice}
                      onChange={(e) => setTaxOffice(e.target.value)}
                      placeholder="Örn: Marmaris V.D."
                      className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-govde-metin focus:ring-1 focus:ring-bilgi-mavisi outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">Vergi No / VKN</label>
                    <input
                      type="text"
                      value={taxNumber}
                      onChange={(e) => setTaxNumber(e.target.value)}
                      placeholder="Örn: 1234567890"
                      className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-govde-metin focus:ring-1 focus:ring-bilgi-mavisi outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">Telefon</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Örn: +90 (252) 123 45 67"
                      className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-govde-metin focus:ring-1 focus:ring-bilgi-mavisi outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">E-posta</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Örn: info@boratekstil.com"
                      className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-govde-metin focus:ring-1 focus:ring-bilgi-mavisi outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">Firma Adresi</label>
                  <textarea
                    rows={3}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Adresinizi buraya yazınız..."
                    className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-govde-metin focus:ring-1 focus:ring-bilgi-mavisi outline-none resize-none text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">Banka IBAN Numarası</label>
                  <input
                    type="text"
                    value={iban}
                    onChange={(e) => setIban(e.target.value)}
                    placeholder="Örn: TR12 3456 7890 1234 5678 9012 34"
                    className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-govde-metin focus:ring-1 focus:ring-bilgi-mavisi outline-none font-mono"
                  />
                </div>
              </div>
            </div>
            <div className="p-4 bg-surface-container-low border-t border-outline-variant flex justify-end gap-3">
              <button
                className="px-4 py-2 rounded-lg text-govde-metin hover:bg-white border border-transparent hover:border-outline-variant transition-colors"
                onClick={() => setSettingsOpen(false)}
              >
                İptal
              </button>
              <button
                onClick={async () => {
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
                    });
                    setSettingsOpen(false);
                    window.dispatchEvent(new Event('settingsChanged'));
                    alert('Ayarlar başarıyla kaydedildi.');
                  } catch (error) {
                    alert('Ayarlar kaydedilirken hata oluştu.');
                  }
                }}
                className="bg-secondary text-on-secondary px-5 py-2 rounded-lg font-bold hover:brightness-105 active:scale-95 transition-all"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainLayout;
