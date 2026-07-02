import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, tenant, logout } = useAuth();
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

  const [globalSearch, setGlobalSearch] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('sidebarCollapsed') === 'true';
  });

  const sidebarWidthClass = sidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-64';
  const headerWidthClass = sidebarCollapsed ? 'lg:w-[calc(100%-72px)]' : 'lg:w-[calc(100%-16rem)]';
  const mainMarginClass = sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-64';

  // Sayfa değiştiğinde mobil menüyü kapat
  useEffect(() => {
    const timer = setTimeout(() => {
      setMobileMenuOpen(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [location.pathname]);

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

  const isSuperAdmin = user && (user as { tenantId?: string | null }).tenantId === null && (user as { role?: string }).role === 'SUPERADMIN';
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
      <aside className={`bg-sidebar-koyu h-screen ${sidebarWidthClass} fixed left-0 top-0 border-r border-outline-variant flex flex-col py-kenar-payi z-50 transition-all duration-300 ease-in-out ${
        mobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="px-kenar-payi mb-8 flex justify-between items-center">
          {!sidebarCollapsed ? (
            <div>
              <h1 className="text-on-secondary-container text-ust-baslik-md font-ust-baslik-md font-bold tracking-tight truncate max-w-[180px]" title={tenant?.name || 'Süper Admin'}>
                {tenant?.name || 'Süper Admin'}
              </h1>
              <p className="text-on-secondary-container opacity-60 text-kucuk-not font-kucuk-not">Üretim Kontrol Paneli</p>
            </div>
          ) : (
            <div className="mx-auto" title={tenant?.name || 'Süper Admin'}>
              <span className="material-symbols-outlined text-on-secondary-container text-2xl font-bold bg-primary-container p-2 rounded-lg">factory</span>
            </div>
          )}
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
                title={sidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center transition-all duration-200 text-left ${
                  sidebarCollapsed 
                    ? 'justify-center py-3 rounded-lg' 
                    : 'gap-3 px-4 py-3 rounded-lg'
                } ${
                  isActive
                    ? 'bg-secondary text-on-secondary font-semibold shadow-md'
                    : 'text-on-secondary-container opacity-70 hover:opacity-100 hover:bg-primary-container'
                }`}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                {!sidebarCollapsed && <span className="text-govde-metin font-govde-metin">{item.label}</span>}
              </button>
            );
          })}
          {superAdminMenuItems.length > 0 && (
            <>
              <div className="pt-4 pb-1 px-4">
                <div className="border-t border-white/10 pt-3">
                  {!sidebarCollapsed ? (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-secondary-container opacity-40">Süper Admin</p>
                  ) : (
                    <div className="border-t border-white/10 my-1" />
                  )}
                </div>
              </div>
              {superAdminMenuItems.map((item) => {
                const isActive = item.path === '/superadmin' 
                  ? location.pathname === '/superadmin' 
                  : (location.pathname === item.path || location.pathname.startsWith(item.path + '/'));
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={`w-full flex items-center transition-all duration-200 text-left ${
                      sidebarCollapsed 
                        ? 'justify-center py-3 rounded-lg' 
                        : 'gap-3 px-4 py-3 rounded-lg'
                    } ${
                      isActive
                        ? 'bg-secondary text-on-secondary font-semibold shadow-md'
                        : 'text-on-secondary-container opacity-70 hover:opacity-100 hover:bg-primary-container'
                    }`}
                  >
                    <span className="material-symbols-outlined">{item.icon}</span>
                    {!sidebarCollapsed && <span className="text-govde-metin font-govde-metin">{item.label}</span>}
                  </button>
                );
              })}
            </>
          )}
        </nav>
        <div className={`mt-auto pt-6 border-t border-white/10 flex flex-col gap-4 transition-all duration-300 ${
          sidebarCollapsed ? 'items-center px-2' : 'px-6'
        }`}>
          {!sidebarCollapsed ? (
            <>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary/20 text-secondary flex items-center justify-center font-bold text-sm border-2 border-secondary select-none">
                  {(user?.name || user?.email || 'K')[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-on-secondary-container text-govde-metin font-semibold truncate" title={user?.name || user?.email}>
                    {user?.name || user?.email || 'Kullanıcı'}
                  </p>
                  <p className="text-on-secondary-container opacity-50 text-kucuk-not truncate">{user?.role || 'ADMIN'}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2 w-full">
                <button
                  onClick={() => navigate('/settings')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all text-sm font-semibold border border-white/10"
                >
                  <span className="material-symbols-outlined text-sm">settings</span>
                  Sistem Ayarları
                </button>
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
            </>
          ) : (
            <>
              <div 
                title={`${user?.name || user?.email || 'Kullanıcı'} (${user?.role || 'ADMIN'})`}
                className="w-10 h-10 rounded-full bg-secondary/20 text-secondary flex items-center justify-center font-bold text-sm border-2 border-secondary cursor-pointer select-none"
                onClick={() => navigate('/settings')}
              >
                {(user?.name || user?.email || 'K')[0].toUpperCase()}
              </div>
              <button
                onClick={() => navigate('/settings')}
                title="Sistem Ayarları"
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all border border-white/10"
              >
                <span className="material-symbols-outlined">settings</span>
              </button>
              <button
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                title="Çıkış Yap"
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white transition-all"
              >
                <span className="material-symbols-outlined">logout</span>
              </button>
            </>
          )}
        </div>
      </aside>

      {/* Main Content Canvas */}
      <main className={`min-h-screen transition-all duration-300 ease-in-out ${mainMarginClass}`}>
        {/* Top Nav Bar */}
        <header className={`fixed top-0 right-0 w-full z-40 bg-surface-container-lowest border-b border-outline-variant h-16 px-4 lg:px-kenar-payi flex justify-between items-center shadow-sm transition-all duration-300 ease-in-out ${headerWidthClass}`}>
          <div className="flex items-center gap-2 lg:gap-4 flex-1 min-w-0">
            {/* Hamburger Burger Menu Button */}
            <button
              onClick={() => {
                if (window.innerWidth >= 1024) {
                  setSidebarCollapsed(prev => {
                    const next = !prev;
                    localStorage.setItem('sidebarCollapsed', String(next));
                    return next;
                  });
                } else {
                  setMobileMenuOpen(true);
                }
              }}
              className="p-2 hover:bg-surface-container-low rounded-full transition-colors flex items-center justify-center"
              title="Menüyü Aç/Kapat"
            >
              <span className="material-symbols-outlined text-on-surface">menu</span>
            </button>
            <h2 className="text-alt-baslik font-alt-baslik font-bold text-on-surface pr-2 truncate">{getHeaderTitle()}</h2>
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
              onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
              className="p-2 hover:bg-surface-container-low rounded-full transition-colors flex text-on-surface"
              title={theme === 'light' ? 'Karanlık Moda Geç' : 'Aydınlık Moda Geç'}
            >
              <span className="material-symbols-outlined">
                {theme === 'light' ? 'dark_mode' : 'light_mode'}
              </span>
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
    </div>
  );
};

export default MainLayout;
