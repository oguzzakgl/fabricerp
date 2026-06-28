import './style.css';

// API ve ERP URL'lerini ortama göre dinamik belirle
// Üretimde .env ile override edilebilir, geliştirmede otomatik çalışır
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

// ERP uygulaması bu marketing sitesiyle aynı ngrok domain'ini paylaşıyor:
// marketing: port 4000 → ngrok-free.dev
// frontend:  port 5173 → aynı veya farklı ngrok URL (ücretsiz hesapta aynı)
// Ngrok üzerinden açıldığında tarayıcı aynı domain'dedir, sadece portu değiştirmek yeterli değil.
// Bu yüzden frontend URL'sini de env ile ayarlıyoruz.
const ERP_APP_URL = import.meta.env.VITE_ERP_APP_URL || 'http://localhost:5173/login';

// Router setup
const routes = {
  '/': renderLanding,
  '/register': renderRegister,
  '/login': renderLogin,
};

function router() {
  const path = window.location.pathname;
  const renderer = routes[path] || renderLanding;
  
  // Clean up any event listeners from previous views
  document.getElementById('app').innerHTML = '';
  
  // Render current view
  renderer();
  
  // Bind internal links
  document.querySelectorAll('a[data-link]').forEach(anchor => {
    anchor.removeEventListener('click', handleLinkClick);
    anchor.addEventListener('click', handleLinkClick);
  });
}

function handleLinkClick(e) {
  e.preventDefault();
  const href = e.currentTarget.getAttribute('href');
  history.pushState(null, null, href);
  router();
}

window.addEventListener('popstate', router);

// Navigation utility
function navigateTo(path) {
  history.pushState(null, null, path);
  router();
}

// ----------------------------------------------------
// Navbar Component
// ----------------------------------------------------
function getNavbarHtml() {
  const currentPath = window.location.pathname;
  return `
    <nav class="navbar">
      <a href="/" data-link class="logo">
        <span class="material-symbols-outlined icon">layers</span>
        <span>FabricERP</span>
      </a>
      <div class="nav-links">
        <a href="/" data-link>Özellikler</a>
        <a href="/login" data-link class="btn btn-secondary">Giriş Yap</a>
        <a href="/register" data-link class="btn btn-primary">Ücretsiz Dene</a>
      </div>
    </nav>
  `;
}

// ----------------------------------------------------
// Landing Page View
// ----------------------------------------------------
function renderLanding() {
  const app = document.getElementById('app');
  app.innerHTML = `
    ${getNavbarHtml()}
    <div class="hero-section">
      <div class="hero-tag">FabricERP SaaS Çözümü v1.0</div>
      <h1 class="hero-title">Tekstil Fabrikanız İçin Dijital Kontrol Paneli</h1>
      <p class="hero-subtitle text-secondary">
        Cari hesaplar, iplik ve kumaş envanterleri, siparişler, faturalar ve finansal süreçlerinizi tek bir modern platform üzerinden, güvenli ve akıllıca yönetin.
      </p>
      <div class="hero-actions">
        <a href="/register" data-link class="btn btn-accent btn-lg" style="font-size: 1.125rem; padding: 1rem 2rem;">
          Hemen Kaydol & Başla
        </a>
        <a href="/login" data-link class="btn btn-secondary btn-lg" style="font-size: 1.125rem; padding: 1rem 2rem;">
          Yönetici Girişi
        </a>
      </div>
      
      <div class="features-grid">
        <div class="glass-card feature-card">
          <div class="feature-icon">
            <span class="material-symbols-outlined">group</span>
          </div>
          <h3>Cari Hesap Yönetimi</h3>
          <p>Müşteri ve tedarikçilerinizi borç/alacak takipleriyle birlikte kurumsal düzeyde yönetin.</p>
        </div>
        <div class="glass-card feature-card">
          <div class="feature-icon">
            <span class="material-symbols-outlined">inventory_2</span>
          </div>
          <h3>İplik Envanteri</h3>
          <p>Lot numaraları, kg miktarları, tedarikçileri ve birim fiyatları detaylarıyla iplik stoklarını izleyin.</p>
        </div>
        <div class="glass-card feature-card">
          <div class="feature-icon">
            <span class="material-symbols-outlined">layers</span>
          </div>
          <h3>Kumaş Topları</h3>
          <p>Üretim reçeteleriyle otomatik maliyet hesabı yapılmış, barkodlu kumaş toplarını yönetin.</p>
        </div>
        <div class="glass-card feature-card">
          <div class="feature-icon">
            <span class="material-symbols-outlined">shopping_cart</span>
          </div>
          <h3>Sipariş Takibi</h3>
          <p>Envanterdeki kumaşları rezerve ederek siparişleri onaylayın, iptal edin veya sevk edin.</p>
        </div>
        <div class="glass-card feature-card">
          <div class="feature-icon">
            <span class="material-symbols-outlined">receipt_long</span>
          </div>
          <h3>Faturalandırma</h3>
          <p>Siparişlerden otomatik fatura oluşturun ve vergi dairesi/no entegrasyonuyla resmi dökümler alın.</p>
        </div>
        <div class="glass-card feature-card">
          <div class="feature-icon">
            <span class="material-symbols-outlined">account_balance_wallet</span>
          </div>
          <h3>Finans (Çek/Senet)</h3>
          <p>Kasa, banka, çek ve senet hareketlerinizi tahsil, ödeme ve ciro durumlarıyla kontrol edin.</p>
        </div>
        <div class="glass-card feature-card">
          <div class="feature-icon">
            <span class="material-symbols-outlined">photo_camera</span>
          </div>
          <h3>Yapay Zeka Destekli OCR Tarama</h3>
          <p>Kumaş toplarının etiketlerini kameranızla veya galeri resimleriyle taratıp saniyeler içinde akıllı stok girişi yapın.</p>
        </div>
      </div>
    </div>
  `;
}

// ----------------------------------------------------
// Registration View
// ----------------------------------------------------
function renderRegister() {
  const app = document.getElementById('app');
  app.innerHTML = `
    ${getNavbarHtml()}
    <div class="form-container">
      <div class="glass-card auth-card">
        <div class="auth-header">
          <h2>Hemen Ücretsiz Katılın</h2>
          <p>FabricERP SaaS hesabı açın ve fabrikanızı dijitalleştirin</p>
        </div>
        
        <div id="alert-box"></div>
        
        <form id="register-form">
          <div class="form-group">
            <label class="form-label" for="email">E-posta Adresi</label>
            <div class="input-wrapper">
              <span class="material-symbols-outlined input-icon">mail</span>
              <input type="email" id="email" class="form-input" placeholder="isim@fabrika.com" required />
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label" for="password">Şifre (Min 6 Karakter)</label>
            <div class="input-wrapper">
              <span class="material-symbols-outlined input-icon">lock</span>
              <input type="password" id="password" class="form-input" placeholder="••••••••" required minlength="6" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="inviteCode">Davetiye Kodu</label>
            <div class="input-wrapper">
              <span class="material-symbols-outlined input-icon">key</span>
              <input type="text" id="inviteCode" class="form-input" placeholder="Yöneticinizden aldığınız kod" required />
            </div>
            <div style="text-align: right; margin-top: 0.35rem;">
              <button type="button" id="request-invite-btn" style="background: none; border: none; color: #10b981; text-decoration: underline; font-size: 0.8rem; font-weight: bold; cursor: pointer; display: inline-flex; align-items: center; gap: 0.25rem;">
                <span class="material-symbols-outlined" style="font-size: 0.95rem;">mail</span>
                Davet Kodunuz Yok mu? Kodu Talep Et
              </button>
            </div>
          </div>
          
          <button type="submit" id="submit-btn" class="btn btn-accent" style="width: 100%; padding: 0.85rem; font-size: 1rem; margin-top: 1rem;">
            Hesabı Oluştur & Başla
          </button>
        </form>
        
        <div class="form-footer">
          Zaten hesabınız var mı? <a href="/login" data-link>Giriş Yapın</a>
        </div>
      </div>
    </div>
  `;

  // Bind Request Invite Button
  const requestInviteBtn = document.getElementById('request-invite-btn');
  requestInviteBtn.addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    const alertBox = document.getElementById('alert-box');
    
    if (!email) {
      alertBox.innerHTML = `
        <div class="alert alert-error">
          <span class="material-symbols-outlined">error</span>
          Lütfen önce E-posta Adresi alanını doldurunuz.
        </div>
      `;
      return;
    }
    if (!email.includes('@')) {
      alertBox.innerHTML = `
        <div class="alert alert-error">
          <span class="material-symbols-outlined">error</span>
          Lütfen geçerli bir e-posta adresi giriniz.
        </div>
      `;
      return;
    }

    alertBox.innerHTML = '';
    requestInviteBtn.disabled = true;
    requestInviteBtn.innerText = 'Talebiniz İletiliyor...';

    try {
      const response = await fetch(`${API_BASE_URL}/auth/request-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Talebiniz iletilemedi.');
      }
      
      alertBox.innerHTML = `
        <div class="alert alert-success">
          <span class="material-symbols-outlined">check_circle</span>
          Davet kodu talebiniz yöneticiye başarıyla iletilmiştir. İnceleme sonrası kodunuz e-posta adresinize gönderilecektir.
        </div>
      `;
      requestInviteBtn.innerText = 'Davet Kodu Talebiniz Alındı ✅';
    } catch (err) {
      requestInviteBtn.disabled = false;
      requestInviteBtn.innerText = 'Davet Kodunuz Yok mu? Kodu Talep Et';
      alertBox.innerHTML = `
        <div class="alert alert-error">
          <span class="material-symbols-outlined">error</span>
          ${err.message || 'Bir hata oluştu.'}
        </div>
      `;
    }
  });

  // Bind Form Submit
  const form = document.getElementById('register-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const inviteCode = document.getElementById('inviteCode').value.trim();
    
    const alertBox = document.getElementById('alert-box');
    const submitBtn = document.getElementById('submit-btn');
    
    alertBox.innerHTML = '';
    submitBtn.disabled = true;
    submitBtn.innerText = 'Hesap Oluşturuluyor...';
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, inviteCode }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Kayıt olurken bir sorun oluştu.');
      }
      
      alertBox.innerHTML = `
        <div class="alert alert-success">
          <span class="material-symbols-outlined">check_circle</span>
          Başarıyla kayıt olundu! ERP paneline yönlendiriliyorsunuz...
        </div>
      `;
      
      // Redirect to ERP with token query param
      setTimeout(() => {
        window.location.href = `${ERP_APP_URL}?token=${result.token}`;
      }, 1500);
      
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Hesabı Oluştur & Başla';
      alertBox.innerHTML = `
        <div class="alert alert-error">
          <span class="material-symbols-outlined">error</span>
          ${err.message}
        </div>
      `;
    }
  });
}

// ----------------------------------------------------
// Login View
// ----------------------------------------------------
function renderLogin() {
  const app = document.getElementById('app');
  app.innerHTML = `
    ${getNavbarHtml()}
    <div class="form-container">
      <div class="glass-card auth-card">
        <div class="auth-header">
          <h2>Yönetici Girişi</h2>
          <p>FabricERP paneline erişmek için oturum açın</p>
        </div>
        
        <div id="alert-box"></div>
        
        <form id="login-form">
          <div class="form-group">
            <label class="form-label" for="email">E-posta Adresi</label>
            <div class="input-wrapper">
              <span class="material-symbols-outlined input-icon">mail</span>
              <input type="email" id="email" class="form-input" placeholder="isim@fabrika.com" required />
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label" for="password">Şifre</label>
            <div class="input-wrapper">
              <span class="material-symbols-outlined input-icon">lock</span>
              <input type="password" id="password" class="form-input" placeholder="••••••••" required />
            </div>
          </div>
          
          <button type="submit" id="submit-btn" class="btn btn-primary" style="width: 100%; padding: 0.85rem; font-size: 1rem; margin-top: 1rem;">
            Giriş Yap
          </button>
        </form>
        
        <div class="form-footer">
          Hesabınız yok mu? <a href="/register" data-link>Hemen Kaydolun</a>
        </div>
      </div>
    </div>
  `;

  // Bind Form Submit
  const form = document.getElementById('login-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    
    const alertBox = document.getElementById('alert-box');
    const submitBtn = document.getElementById('submit-btn');
    
    alertBox.innerHTML = '';
    submitBtn.disabled = true;
    submitBtn.innerText = 'Giriş Yapılıyor...';
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Giriş yapılamadı. Bilgilerinizi kontrol edin.');
      }
      
      alertBox.innerHTML = `
        <div class="alert alert-success">
          <span class="material-symbols-outlined">check_circle</span>
          Giriş başarılı! ERP paneline yönlendiriliyorsunuz...
        </div>
      `;
      
      // Redirect to ERP with token query param
      setTimeout(() => {
        window.location.href = `${ERP_APP_URL}?token=${result.token}`;
      }, 1500);
      
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Giriş Yap';
      alertBox.innerHTML = `
        <div class="alert alert-error">
          <span class="material-symbols-outlined">error</span>
          ${err.message}
        </div>
      `;
    }
  });
}

// Initial Routing
router();
