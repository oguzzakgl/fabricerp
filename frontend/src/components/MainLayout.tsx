import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { Modal } from 'antd';
import apiClient from '../api/client';
import { useAuth } from '../contexts/AuthContext';

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, tenant, logout } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'info' | 'team'>('info');
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string; role: string; createdAt: string }>>([]);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('USER');
  const [userFormOpen, setUserFormOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [taxRate, setTaxRate] = useState(20);
  const [companyName, setCompanyName] = useState('');
  const [taxOffice, setTaxOffice] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [iban, setIban] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sayfa değiştiğinde mobil menüyü kapat
  useEffect(() => {
    const timer = setTimeout(() => {
      setMobileMenuOpen(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [location.pathname]);

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

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSettings();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (settingsOpen) {
      const timer = setTimeout(() => {
        fetchUsers();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [settingsOpen]);

  const menuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: '/accounts', label: 'Cari Hesaplar', icon: 'group' },
    { path: '/yarn-stocks', label: 'İplik Envanteri', icon: 'inventory_2' },
    { path: '/fabrics', label: 'Kumaş Envanteri', icon: 'layers' },
    { path: '/orders', label: 'Sipariş Yönetimi', icon: 'shopping_cart' },
    { path: '/invoices', label: 'Faturalandırma', icon: 'receipt_long' },
    { path: '/waybills', label: 'İrsaliyeler', icon: 'local_shipping' },
    { path: '/finance', label: 'Finans', icon: 'account_balance_wallet' },
  ];

  const isSuperAdmin = user && (user as { tenantId?: string | null }).tenantId === null;
  const superAdminMenuItems = isSuperAdmin ? [
    { path: '/superadmin', label: 'Admin Dashboard', icon: 'admin_panel_settings' },
    { path: '/superadmin/tenants', label: 'Müşteri Firmalar', icon: 'corporate_fare' },
    { path: '/superadmin/users', label: 'Kullanıcı Hesapları', icon: 'manage_accounts' },
    { path: '/superadmin/invites', label: 'Davet Kodları', icon: 'vpn_key' },
  ] : [];

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
    } else if (/^irs|irsaliye/i.test(q)) {
      navigate(`/waybills`);
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
      case '/waybills': return 'İrsaliyeler';
      case '/finance': return 'Finans (Çek/Senet)';
      case '/superadmin': return 'Admin Dashboard';
      case '/superadmin/tenants': return 'Müşteri Firmalar';
      case '/superadmin/users': return 'Kullanıcı Hesapları';
      case '/superadmin/invites': return 'Davet Kodları';
      default:
        if (location.pathname.startsWith('/superadmin/tenants/')) return 'Firma Detayı';
        return 'Tekstil ERP';
    }
  };

  return (
    <div className="min-h-screen bg-arka-plan-gri text-on-surface">
      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-xs transition-opacity duration-300"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`bg-sidebar-koyu h-screen w-64 fixed left-0 top-0 border-r border-outline-variant flex flex-col py-kenar-payi z-50 transition-transform duration-300 ease-in-out ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="px-kenar-payi mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-on-secondary-container text-ust-baslik-md font-ust-baslik-md font-bold tracking-tight truncate max-w-[180px]" title={tenant?.name || 'Tekstil ERP'}>
              {tenant?.name || 'Tekstil ERP'}
            </h1>
            <p className="text-on-secondary-container opacity-60 text-kucuk-not font-kucuk-not">Üretim Kontrol Paneli</p>
          </div>
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden text-on-secondary-container opacity-70 hover:opacity-100 material-symbols-outlined"
          >
            close
          </button>
        </div>
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto hide-scrollbar">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
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
          {superAdminMenuItems.length > 0 && (
            <>
              <div className="pt-4 pb-1 px-4">
                <div className="border-t border-white/10 pt-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-secondary-container opacity-40">Süper Admin</p>
                </div>
              </div>
              {superAdminMenuItems.map((item) => {
                const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
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
            </>
          )}
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
      <main className="lg:ml-64 min-h-screen">
        {/* Top Nav Bar */}
        <header className="fixed top-0 right-0 w-full lg:w-[calc(100%-16rem)] z-40 bg-surface-container-lowest border-b border-outline-variant h-16 px-4 lg:px-kenar-payi flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-2 lg:gap-4 flex-1 min-w-0">
            {/* Hamburger Burger Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 hover:bg-surface-container-low rounded-full transition-colors flex items-center justify-center"
              title="Menüyü Aç"
            >
              <span className="material-symbols-outlined text-on-surface">menu</span>
            </button>
            <h2 className="text-alt-baslik font-alt-baslik font-bold text-on-surface truncate pr-2">{getHeaderTitle()}</h2>
            <div className="relative w-full max-w-[140px] sm:max-w-xs md:max-w-md hidden sm:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">search</span>
              <input
                className="w-full pl-9 pr-3 py-1.5 bg-surface-container-low border border-outline-variant rounded text-sm focus:ring-1 focus:ring-bilgi-mavisi outline-none"
                placeholder="Barkod, Lot No veya Cari Ara..."
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onKeyDown={handleGlobalSearch}
              />
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-3">
            <button className="p-2 hover:bg-surface-container-low rounded-full transition-colors relative hidden sm:flex" title="Bildirimler (Yakında)">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button 
              onClick={() => setSettingsOpen(true)}
              className="p-2 hover:bg-surface-container-low rounded-full transition-colors flex"
              title="Ayarlar"
            >
              <span className="material-symbols-outlined">settings</span>
            </button>
            <button className="p-2 hover:bg-surface-container-low rounded-full transition-colors hidden sm:flex">
              <span className="material-symbols-outlined">help_outline</span>
            </button>
          </div>
        </header>

        <div className="pt-20 px-3 lg:px-kenar-payi pb-kenar-payi">
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
            {/* Sekmeler */}
            <div className="flex border-b border-outline-variant bg-surface-container-low px-4">
              <button
                onClick={() => setSettingsTab('info')}
                className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all ${
                  settingsTab === 'info'
                    ? 'border-secondary text-secondary'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Firma Bilgileri & OCR
              </button>
              <button
                onClick={() => setSettingsTab('team')}
                className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all ${
                  settingsTab === 'team'
                    ? 'border-secondary text-secondary'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Ekip Üyeleri & Yetkiler
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto bg-arka-plan-gri">
              {settingsTab === 'info' ? (
                <>
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

                    <hr className="border-outline-variant" />

                    {/* Gemini API Key */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-secondary text-base">psychology</span>
                        <h5 className="font-bold text-sm text-on-surface">Yapay Zeka & OCR Ayarları</h5>
                      </div>
                      <p className="text-xs text-on-surface-variant">Kamera ile etiket okuma (OCR) zekasının çalışması için kendi Google Gemini API anahtarınızı buraya girebilirsiniz.</p>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">Gemini API Key (API Anahtarı)</label>
                        <input
                          type="password"
                          value={geminiApiKey}
                          onChange={(e) => setGeminiApiKey(e.target.value)}
                          placeholder="Örn: AIzaSyD-..."
                          className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-govde-metin focus:ring-1 focus:ring-bilgi-mavisi outline-none font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h5 className="font-bold text-sm text-on-surface">Ekip Üyeleri</h5>
                      <p className="text-xs text-on-surface-variant">Firma bünyesinde çalışan kullanıcıları yönetin.</p>
                    </div>
                    {!userFormOpen && (
                      <button
                        onClick={() => setUserFormOpen(true)}
                        className="bg-secondary text-on-secondary px-3 py-1.5 rounded-lg text-xs font-bold hover:brightness-105 active:scale-95 flex items-center gap-1.5 transition-all"
                      >
                        <span className="material-symbols-outlined text-xs">add</span>
                        Yeni Üye Ekle
                      </button>
                    )}
                  </div>

                  {userFormOpen && (
                    <form onSubmit={handleCreateUser} className="bg-white border border-outline-variant p-4 rounded-xl space-y-3">
                      <h6 className="font-bold text-xs text-on-surface">Yeni Kullanıcı Bilgileri</h6>
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="Ad Soyad"
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          className="w-full px-3 py-1.5 bg-arka-plan-gri border border-outline-variant rounded text-xs outline-none focus:ring-1 focus:ring-bilgi-mavisi"
                        />
                        <input
                          type="email"
                          placeholder="E-posta Adresi"
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                          className="w-full px-3 py-1.5 bg-arka-plan-gri border border-outline-variant rounded text-xs outline-none focus:ring-1 focus:ring-bilgi-mavisi"
                        />
                        <input
                          type="password"
                          placeholder="Şifre"
                          value={newUserPassword}
                          onChange={(e) => setNewUserPassword(e.target.value)}
                          className="w-full px-3 py-1.5 bg-arka-plan-gri border border-outline-variant rounded text-xs outline-none focus:ring-1 focus:ring-bilgi-mavisi"
                        />
                        <div className="flex gap-2 items-center">
                          <label className="text-xs text-on-surface-variant font-semibold">Rol:</label>
                          <select
                            value={newUserRole}
                            onChange={(e) => setNewUserRole(e.target.value)}
                            className="bg-arka-plan-gri border border-outline-variant rounded px-2 py-1 text-xs outline-none"
                          >
                            <option value="USER">Personel (Standart)</option>
                            <option value="ADMIN">Admin (Yönetici)</option>
                            <option value="DEPO">Depo Sorumlusu</option>
                            <option value="MUHASEBE">Muhasebe Sorumlusu</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant">
                        <button
                          type="button"
                          onClick={() => setUserFormOpen(false)}
                          className="px-3 py-1 rounded text-xs text-on-surface-variant hover:bg-arka-plan-gri border border-transparent hover:border-outline-variant transition-colors"
                        >
                          Vazgeç
                        </button>
                        <button
                          type="submit"
                          className="bg-secondary text-on-secondary px-4 py-1 rounded text-xs font-bold hover:brightness-105 active:scale-95 transition-all"
                        >
                          Kaydet
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="bg-white border border-outline-variant rounded-xl overflow-hidden">
                    {users.length === 0 ? (
                      <div className="p-6 text-center text-xs text-on-surface-variant">Ekip üyesi bulunmamaktadır.</div>
                    ) : (
                      <div className="divide-y divide-outline-variant">
                        {users.map((u) => (
                          <div key={u.id} className="p-3 flex items-center justify-between">
                            <div>
                              <p className="font-bold text-xs text-on-surface">{u.name}</p>
                              <p className="text-[11px] text-on-surface-variant">{u.email}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                u.role === 'ADMIN' ? 'bg-secondary/15 text-secondary' : 'bg-bilgi-mavisi/15 text-bilgi-mavisi'
                              }`}>
                                {u.role}
                              </span>
                              {user?.id !== u.id && (
                                <button
                                  onClick={() => handleDeleteUser(u.id)}
                                  className="text-red-500 hover:text-red-700 material-symbols-outlined text-base"
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
            </div>

            <div className="p-4 bg-surface-container-low border-t border-outline-variant flex justify-end gap-3">
              <button
                className="px-4 py-2 rounded-lg text-govde-metin hover:bg-white border border-transparent hover:border-outline-variant transition-colors"
                onClick={() => setSettingsOpen(false)}
              >
                Kapat
              </button>
              {settingsTab === 'info' && (
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
                        geminiApiKey,
                      });
                      setSettingsOpen(false);
                      window.dispatchEvent(new Event('settingsChanged'));
                      alert('Ayarlar başarıyla kaydedildi.');
                    } catch (error) {
                      console.error('Ayarlar kaydedilirken hata oluştu:', error);
                      alert('Ayarlar kaydedilirken hata oluştu.');
                    }
                  }}
                  className="bg-secondary text-on-secondary px-5 py-2 rounded-lg font-bold hover:brightness-105 active:scale-95 transition-all"
                >
                  Kaydet
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainLayout;
