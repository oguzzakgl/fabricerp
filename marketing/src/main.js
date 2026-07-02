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
  '/contact': renderContact,
};

function router() {
  const path = window.location.pathname;
  if (path === '/login') {
    window.location.href = ERP_APP_URL;
    return;
  }
  const renderer = routes[path] || renderLanding;
  
  document.getElementById('app').innerHTML = '';
  renderer();
  
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

function navigateTo(path) {
  history.pushState(null, null, path);
  router();
}

// ----------------------------------------------------
// Navbar Component
// ----------------------------------------------------
function getNavbarHtml() {
  return `
    <div class="navbar-wrapper">
      <nav class="navbar">
        <a href="/" data-link class="logo">
          <span class="material-symbols-outlined icon">layers</span>
          <span>Fabricore</span>
        </a>
        <div class="nav-links">
          <a href="/#features">Özellikler</a>
          <a href="/#pricing">Fiyatlandırma</a>
          <a href="${ERP_APP_URL}" class="btn btn-secondary">Giriş Yap</a>
          <a href="/register" data-link class="btn btn-accent">Kayıt Ol</a>
        </div>
      </nav>
    </div>
    <div class="navbar-spacer"></div>
  `;
}

// ----------------------------------------------------
// Landing Page View
// ----------------------------------------------------
function renderLanding() {
  // Dynamic SEO for landing page
  document.title = 'Fabricore — Tekstil Stok, Ön Muhasebe ve Sipariş Yönetim Programı';
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', 'Fabricore, tekstil fabrikaları için iplik stok takip, kumaş envanteri, ön muhasebe, gelir gider yönetimi ve yapay zeka destekli OCR etiket okuma sunan bulut tabanlı ERP platformudur.');

  const app = document.getElementById('app');
  app.innerHTML = `
    ${getNavbarHtml()}
    
    <!-- Hero Section -->
    <div class="hero-section">
      <div class="hero-tag">Fabricore SaaS Çözümü v1.2</div>
      <h1 class="hero-title">Tekstil Fabrikası İçin Stok, Ön Muhasebe ve Sipariş Yönetim Programı</h1>
      <p class="hero-subtitle text-secondary">
        İplik stok takibi, kumaş envanteri, cari hesap yönetimi, gelir gider analizi ve yapay zeka destekli OCR etiket okuma — tüm tekstil üretim süreçleriniz tek bir modern SaaS platformunda.
      </p>
      <div class="hero-actions">
        <a href="/register" data-link class="btn btn-accent btn-lg">Ücretsiz Denemeye Başla</a>
        <a href="#features" class="btn btn-secondary btn-lg">Özellikleri Keşfet</a>
      </div>
    </div>

    <!-- Browser Mockup (Demo Area) -->
    <div class="mockup-container max-width-container">
      <div class="browser-mockup glass-card">
        <div class="browser-header">
          <div class="dots">
            <span class="dot red"></span>
            <span class="dot yellow"></span>
            <span class="dot green"></span>
          </div>
          <div class="address-bar">https://app.Fabricore.com/dashboard</div>
        </div>
        <div class="mockup-app-layout">
          <aside class="mockup-sidebar">
            <div class="sidebar-logo"><span class="material-symbols-outlined text-accent">layers</span> Fabricore</div>
            <div class="sidebar-item active"><span class="material-symbols-outlined text-sm">dashboard</span> Panel</div>
            <div class="sidebar-item"><span class="material-symbols-outlined text-sm">group</span> Cari Hesaplar</div>
            <div class="sidebar-item"><span class="material-symbols-outlined text-sm">inventory_2</span> İplik Envanteri</div>
            <div class="sidebar-item"><span class="material-symbols-outlined text-sm">view_in_ar</span> Kumaş Topları</div>
            <div class="sidebar-item"><span class="material-symbols-outlined text-sm">shopping_cart</span> Siparişler</div>
            <div class="sidebar-item"><span class="material-symbols-outlined text-sm">payments</span> Finans & Ödeme</div>
          </aside>
          <main class="mockup-main">
            <div class="mockup-title-bar">
              <h2>Kontrol Paneli</h2>
              <span class="mockup-user-badge">Global Tekstil A.Ş.</span>
            </div>
            <div class="mockup-stats-grid">
              <div class="mockup-stat-card border-blue">
                <span class="label">Müşteri Alacakları</span>
                <span class="value text-error">$124,500</span>
                <span class="subtext">Canlı Kur Çevrimli</span>
              </div>
              <div class="mockup-stat-card border-green">
                <span class="label">Toplam Kumaş Stok</span>
                <span class="value text-success">1,420 Top</span>
                <span class="subtext">OCR Girişli</span>
              </div>
              <div class="mockup-stat-card border-purple">
                <span class="label">Aktif Siparişler</span>
                <span class="value">42 Adet</span>
                <span class="subtext">Müşteri Rezerve</span>
              </div>
            </div>
            <div class="mockup-table-card">
              <h3>Son Kumaş Girişleri (AI OCR Destekli)</h3>
              <div class="mockup-table-row header">
                <span>Top No</span>
                <span>Kumaş Tipi</span>
                <span class="hide-mobile">Renk</span>
                <span>Metraj</span>
                <span class="hide-mobile">Durum</span>
              </div>
              <div class="mockup-table-row">
                <span class="font-mono text-accent">TOP-KM-938210</span>
                <strong>RONA</strong>
                <span class="hide-mobile">Renk 1 (Siyah)</span>
                <strong>104.2 mt</strong>
                <span class="badge badge-success hide-mobile">Mevcut</span>
              </div>
              <div class="mockup-table-row">
                <span class="font-mono text-accent">TOP-KM-427189</span>
                <strong>CROC</strong>
                <span class="hide-mobile">Renk 3 (Lacivert)</span>
                <strong>88.5 mt</strong>
                <span class="badge badge-success hide-mobile">Mevcut</span>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>

    <!-- Core Features Grid -->
    <div id="features" class="section-title-container max-width-container">
      <h2 class="section-title">Temel Özellikler</h2>
      <p class="section-subtitle">Fabricore, tekstil üreticilerinin tüm iş akışlarını — stok takipten ön muhasebeye, gelir giderden sipariş yönetimine — tek bir çatı altında toplar.</p>
    </div>
    
    <div class="features-grid max-width-container">
      <div class="glass-card feature-card">
        <div class="feature-icon"><span class="material-symbols-outlined">group</span></div>
        <h3>Cari Hesap &amp; Ön Muhasebe Yönetimi</h3>
        <p>Müşteri ve tedarikçilerinizin borç/alacak bakiyelerini çoklu para birimiyle yönetin. Tekstil ön muhasebe ihtiyaçlarınız için eksiksiz çözüm.</p>
      </div>
      <div class="glass-card feature-card">
        <div class="feature-icon"><span class="material-symbols-outlined">inventory_2</span></div>
        <h3>İplik Stok &amp; Lot Takip Sistemi</h3>
        <p>Lot numaraları, kg miktarları, tedarikçiler ve birim fiyatlarıyla iplik stoklarınızı anlık olarak izleyin. Kritik stok uyarıları alın.</p>
      </div>
      <div class="glass-card feature-card">
        <div class="feature-icon"><span class="material-symbols-outlined">layers</span></div>
        <h3>Kumaş Topu Envanter Yönetimi</h3>
        <p>Üretim reçeteleriyle otomatik maliyet hesabı yapılmış kumaş toplarını yönetin. Top bazlı stok takibini kolaylaştırın.</p>
      </div>
      <div class="glass-card feature-card">
        <div class="feature-icon"><span class="material-symbols-outlined">shopping_cart</span></div>
        <h3>Sipariş Takibi &amp; Sevkiyat</h3>
        <p>Envanterdeki kumaşları rezerve ederek siparişleri onaylayın, iptal edin veya sevk edin. Müşteri bazlı sipariş geçmişini takip edin.</p>
      </div>
      <div class="glass-card feature-card">
        <div class="feature-icon"><span class="material-symbols-outlined">receipt_long</span></div>
        <h3>Faturalandırma &amp; Fatura Yönetimi</h3>
        <p>Siparişlerden otomatik fatura oluşturun. Vergi dairesi ve vergi numarası entegrasyonuyla resmi belgelerinizi dijital ortamda saklayın.</p>
      </div>
      <div class="glass-card feature-card">
        <div class="feature-icon"><span class="material-symbols-outlined">account_balance_wallet</span></div>
        <h3>Gelir Gider &amp; Finans Takibi</h3>
        <p>Kasa, banka, çek ve senet hareketlerinizi gelir gider raporlarıyla takip edin. Tahsil, ödeme ve ciro durumlarını gerçek zamanlı görün.</p>
      </div>
    </div>

    <!-- Interactive Tabs Section -->
    <div class="interactive-tabs-section max-width-container">
      <div class="tabs-header">
        <button class="tab-btn active" data-tab="ocr">Yapay Zeka OCR</button>
        <button class="tab-btn" data-tab="multicurrency">Çoklu Para Birimi</button>
        <button class="tab-btn" data-tab="barcode">Reçete & Maliyet</button>
      </div>
      <div class="tab-content glass-card">
        <div class="tab-text-side">
          <h3 id="tab-content-title">Yapay Zeka Destekli OCR Etiket Okuma</h3>
          <p id="tab-content-text" class="text-secondary">
            Akıllı telefon kameranızdan veya galerinizden yüklediğiniz kumaş etiket fotoğraflarını saniyeler içinde analiz edin. Gemini entegrasyonu sayesinde kumaş adı, metre, kg ve renk kodu otomatik olarak çıkarılır ve hata payı en aza iner.
          </p>
        </div>
        <div class="tab-image-side">
          <img id="tab-content-image" src="https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=600&q=80" alt="Tekstil kumaş etiket OCR tarama sistemi" />
        </div>
      </div>
    </div>

    <!-- Live Currency Rate Widget (Interactive) -->
    <div class="live-rates-section max-width-container">
      <div class="rates-intro">
        <h2>Canlı Kurlarla Otomatik Hesaplama</h2>
        <p class="text-secondary">
          Cari hesaplarınızda hangi para birimini kullanırsanız kullanın, sistemimiz canlı döviz kurları ile ödemelerinizi otomatik olarak çevirir ve bakiye hesabını günceller.
        </p>
      </div>
      <div class="rates-calculator-card glass-card">
        <div class="rates-grid-mini">
          <div class="rate-badge">
            <span class="currency">USD / TRY</span>
            <span id="rate-usd-try" class="rate-val">34.02</span>
          </div>
          <div class="rate-badge">
            <span class="currency">EUR / TRY</span>
            <span id="rate-eur-try" class="rate-val">37.05</span>
          </div>
        </div>
        <div class="calculator-form">
          <h4>Hızlı Döviz Çevirici</h4>
          <div class="calc-inputs-row">
            <input type="number" id="calc-amount" placeholder="Tutar girin" value="1000" />
            <select id="calc-from">
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="TRY">TRY</option>
            </select>
            <span class="arrow">&rarr;</span>
            <select id="calc-to">
              <option value="TRY">TRY</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div class="calc-result-row">
            <span>Dönüştürülen Tutar:</span>
            <strong id="calc-result" class="text-accent">34.020,00 TRY</strong>
          </div>
        </div>
      </div>
    </div>

    <!-- Pricing Section -->
    <div id="pricing" class="section-title-container max-width-container">
      <h2 class="section-title">Esnek Fiyatlandırma Planları</h2>
      <p class="section-subtitle">Fabrikanızın büyüklüğüne en uygun paketi seçin, dilediğiniz zaman yükseltin.</p>
    </div>

    <div class="pricing-grid max-width-container">
      <div class="pricing-card glass-card">
        <h3>Atölye (Başlangıç)</h3>
        <div class="price">₺1.499 <span class="period">/ ay</span></div>
        <p class="desc">Küçük ölçekli tekstil atölyeleri için ideal.</p>
        <ul class="pricing-features">
          <li><span class="material-symbols-outlined icon text-success">check</span> 100 Top Kumaş Limiti</li>
          <li><span class="material-symbols-outlined icon text-success">check</span> 1 Kullanıcı Erişimi</li>
          <li><span class="material-symbols-outlined icon text-success">check</span> Standart Envanter Takibi</li>
          <li><span class="material-symbols-outlined icon text-success">check</span> E-posta Desteği</li>
        </ul>
        <a href="/register" data-link class="btn btn-secondary w-full">Başlangıç Yap</a>
      </div>
      
      <div class="pricing-card glass-card popular">
        <div class="popular-badge">En Çok Tercih Edilen</div>
        <h3>Fabrika (Profesyonel)</h3>
        <div class="price">₺3.499 <span class="period">/ ay</span></div>
        <p class="desc">Orta ve büyük ölçekli entegre tekstil işletmeleri için.</p>
        <ul class="pricing-features">
          <li><span class="material-symbols-outlined icon text-success">check</span> <strong>Sınırsız Kumaş Topu</strong></li>
          <li><span class="material-symbols-outlined icon text-success">check</span> Sınırsız Kullanıcı Tanımlama</li>
          <li><span class="material-symbols-outlined icon text-success">check</span> <strong>Gemini Yapay Zeka OCR</strong></li>
          <li><span class="material-symbols-outlined icon text-success">check</span> Çoklu Para Birimli Cari Hesap</li>
          <li><span class="material-symbols-outlined icon text-success">check</span> Reçeteli İplik Maliyet Hesabı</li>
        </ul>
        <a href="/register" data-link class="btn btn-accent w-full">Ücretsiz Denemeyi Başlat</a>
      </div>

      <div class="pricing-card glass-card">
        <h3>Kurumsal (Enterprise)</h3>
        <div class="price">Özel Fiyat</div>
        <p class="desc">Büyük markalar ve çoklu üretim tesisleri için.</p>
        <ul class="pricing-features">
          <li><span class="material-symbols-outlined icon text-success">check</span> Özel Bulut/Sunucu Kurulumu</li>
          <li><span class="material-symbols-outlined icon text-success">check</span> Şirket İçi (On-Premise) Destek</li>
          <li><span class="material-symbols-outlined icon text-success">check</span> Gelişmiş API Entegrasyonları</li>
          <li><span class="material-symbols-outlined icon text-success">check</span> 7/24 Kesintisiz VIP Destek</li>
        </ul>
        <a href="/contact" data-link class="btn btn-secondary w-full">Bizimle İletişime Geçin</a>
      </div>
    </div>

    <!-- FAQ Section (Accordion) -->
    <div class="faq-section max-width-container">
      <h2 class="section-title text-center">Sıkça Sorulan Sorular</h2>
      
      <div class="faq-accordion">
        <div class="faq-item glass-card active">
          <div class="faq-header">
            <h4>Tekstil fabrikam için iplik ve kumaş stok takibini nasıl yapabilirim?</h4>
            <span class="material-symbols-outlined toggle-icon">expand_more</span>
          </div>
          <div class="faq-body">
            <p>Fabricore'da iplik stoklarınızı lot numarası, kg miktarı, renk ve tedarikçi bazında kayıt altına alabilirsiniz. Kumaş toplarınızı ise top numarası, metraj ve reçete bilgileriyle yönetebilirsiniz. Kritik stok seviyesi uyarıları sayesinde stoğunuz bitmeden haberdar olursunuz.</p>
          </div>
        </div>

        <div class="faq-item glass-card">
          <div class="faq-header">
            <h4>Tekstil işletmem için ön muhasebe ve gelir gider takibini nasıl yaparım?</h4>
            <span class="material-symbols-outlined toggle-icon">expand_more</span>
          </div>
          <div class="faq-body">
            <p>Fabricore'un ön muhasebe modülü; müşteri alacakları, tedarikçi borçları, çek/senet takibi ve kasa/banka hareketlerini kapsar. Gelir gider raporlarınızı tarih aralığına göre filtreleyerek anlık finansal durumunuzu görebilirsiniz. TRY, USD ve EUR cinsinden çoklu para birimi desteği mevcuttur.</p>
          </div>
        </div>

        <div class="faq-item glass-card">
          <div class="faq-header">
            <h4>Yapay Zeka Destekli OCR etiket okuma nasıl çalışır?</h4>
            <span class="material-symbols-outlined toggle-icon">expand_more</span>
          </div>
          <div class="faq-body">
            <p>Akıllı telefon kameranızla veya sisteme yükleyeceğiniz etiket görselleriyle tarama yapabilirsiniz. Gemini yapay zeka modülü, etiket üzerindeki metinleri analiz ederek kumaş türünü, net metrajını, kilogram ağırlığını ve lot kodunu otomatik olarak ayrıştırıp sisteme kaydeder. Manuel veri girişi hatalarını sıfıra indirir.</p>
          </div>
        </div>

        <div class="faq-item glass-card">
          <div class="faq-header">
            <h4>Davetiye kodu nedir ve nereden alabilirim?</h4>
            <span class="material-symbols-outlined toggle-icon">expand_more</span>
          </div>
          <div class="faq-body">
            <p>Sistemimiz SaaS altyapısına sahiptir. Kayıt olurken geçerli bir davetiye kodu girilmesi istenir. Eğer bir davetiye kodunuz yoksa, kayıt sayfasındaki "Davet Talebi Gönder" butonuna basarak e-posta adresinizle yönetici ekibimize talep iletebilirsiniz.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Call to Action Banner -->
    <div class="cta-banner max-width-container glass-card">
      <h2>Tekstil Üretiminizde Dijital Dönüşümü Başlatın</h2>
      <p>Hemen kaydolun ve 14 gün boyunca tüm özellikleri ücretsiz deneyimleyin.</p>
      <a href="/register" data-link class="btn btn-accent btn-lg">Ücretsiz Denemeye Başla</a>
    </div>

    <!-- Footer Component -->
    <footer class="footer max-width-container">
      <div class="footer-bottom">
        <span class="footer-logo"><span class="material-symbols-outlined text-accent">layers</span> Fabricore</span>
        <p>&copy; 2026 Fabricore. Tüm Hakları Saklıdır.</p>
      </div>
    </footer>
  `;

  // Bind Interactive Tab events
  const tabs = document.querySelectorAll('.tab-btn');
  const contentTitle = document.getElementById('tab-content-title');
  const contentText = document.getElementById('tab-content-text');
  const contentImage = document.getElementById('tab-content-image');
  
  const tabData = {
    ocr: {
      title: 'Yapay Zeka Destekli OCR Etiket Okuma',
      text: 'Akıllı telefon kameranızdan veya galerinizden yüklediğiniz kumaş etiket fotoğraflarını saniyeler içinde analiz edin. Gemini entegrasyonu sayesinde kumaş adı, metre, kg ve renk kodu otomatik olarak çıkarılır ve hata payı en aza iner.',
      img: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=600&q=80'
    },
    multicurrency: {
      title: 'Çoklu Para Birimli Cari Bakiye Yönetimi',
      text: 'Müşteri ve tedarikçilerinizin bakiyelerini TRY, USD veya EUR cinsinden yönetin. Farklı para birimlerinde aldığınız ödemeleri canlı kurlar ile anında cari para birimine çevirerek borçtan düşün.',
      img: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=600&q=80'
    },
    barcode: {
      title: 'Gelişmiş Reçete & Envanter Yönetimi',
      text: 'İplik lot numaraları ve reçete ağırlık tanımları ile kumaşın atkı/çözgü iplik maliyetlerini otomatik hesaplayıp kârlılığınızı anlık takip edin.',
      img: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80'
    }
  };

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.getAttribute('data-tab');
      if (tabData[target]) {
        contentTitle.innerText = tabData[target].title;
        contentText.innerText = tabData[target].text;
        contentImage.src = tabData[target].img;
      }
    });
  });

  // Bind FAQ Accordion events
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const header = item.querySelector('.faq-header');
    header.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      faqItems.forEach(i => i.classList.remove('active'));
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });

  // Bind Live Exchange Rate Widget Calculator
  const calcInput = document.getElementById('calc-amount');
  const calcFrom = document.getElementById('calc-from');
  const calcTo = document.getElementById('calc-to');
  const calcResult = document.getElementById('calc-result');
  const rateUsdTry = document.getElementById('rate-usd-try');
  const rateEurTry = document.getElementById('rate-eur-try');

  let exchangeRates = { TRY: 34.02, EUR: 0.92 };

  // Fetch live rates
  fetch('https://open.er-api.com/v6/latest/USD')
    .then(res => res.json())
    .then(data => {
      if (data && data.rates) {
        exchangeRates.TRY = data.rates.TRY || 34.02;
        exchangeRates.EUR = data.rates.EUR || 0.92;
        
        if (rateUsdTry) rateUsdTry.innerText = exchangeRates.TRY.toFixed(2);
        if (rateEurTry) {
          const eurToTry = exchangeRates.TRY / exchangeRates.EUR;
          rateEurTry.innerText = eurToTry.toFixed(2);
        }
        
        updateCalculator();
      }
    })
    .catch(err => console.log('Calculator exchange rates fetch failed:', err));

  function updateCalculator() {
    if (!calcInput || !calcFrom || !calcTo || !calcResult) return;
    
    const amt = parseFloat(calcInput.value) || 0;
    const fromCur = calcFrom.value;
    const toCur = calcTo.value;

    if (fromCur === toCur) {
      calcResult.innerText = `${amt.toFixed(2)} ${toCur}`;
      return;
    }

    // Convert from source to USD base
    let usdAmount = amt;
    if (fromCur === 'TRY') {
      usdAmount = amt / exchangeRates.TRY;
    } else if (fromCur === 'EUR') {
      usdAmount = amt / (exchangeRates.TRY / exchangeRates.EUR); // EUR/USD rates is 1/USD/EUR
      usdAmount = amt * (exchangeRates.EUR);
    }

    // Convert from USD base to target
    let targetAmount = usdAmount;
    if (toCur === 'TRY') {
      targetAmount = usdAmount * exchangeRates.TRY;
    } else if (toCur === 'EUR') {
      targetAmount = usdAmount * (exchangeRates.TRY / exchangeRates.EUR);
      targetAmount = usdAmount / (exchangeRates.EUR);
    }

    calcResult.innerText = `${targetAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${toCur}`;
  }

  [calcInput, calcFrom, calcTo].forEach(el => {
    if (el) el.addEventListener('input', updateCalculator);
  });
}

// ----------------------------------------------------
// Registration View
// ----------------------------------------------------
function renderRegister() {
  // Dynamic SEO for register page
  document.title = 'Kayıt Ol — Fabricore Tekstil Stok ve Muhasebe Programı';
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', 'Fabricore\'a ücretsiz kaydolun. Tekstil fabrikası stok takip, ön muhasebe ve sipariş yönetim sistemine hemen başlayın.');
  const app = document.getElementById('app');
  app.innerHTML = `
    ${getNavbarHtml()}
    <div class="form-container">
      <div class="glass-card auth-card">
        <div class="auth-header">
          <h2>Hemen Ücretsiz Katılın</h2>
          <p>Fabricore SaaS hesabı açın ve fabrikanızı dijitalleştirin</p>
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
          <p>Fabricore paneline erişmek için oturum açın</p>
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

// ----------------------------------------------------
// Contact View
// ----------------------------------------------------
function renderContact() {
  // Dynamic SEO for contact page
  document.title = 'İletişim — Fabricore Tekstil ERP Yazılımı';
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', 'Fabricore hakkında bilgi almak veya Enterprise çözümler için bizimle iletişime geçin.');
  const app = document.getElementById('app');
  app.innerHTML = `
    ${getNavbarHtml()}
    <div class="form-container">
      <div class="glass-card auth-card text-center" style="max-width: 550px; padding: 3rem;">
        <div class="auth-header" style="margin-bottom: 2rem;">
          <span class="material-symbols-outlined text-accent" style="font-size: 3.5rem; margin-bottom: 1rem;">contact_support</span>
          <h2>Bizimle İletişime Geçin</h2>
          <p>Fabricore Enterprise çözümleri veya her türlü sorunuz için bizimle doğrudan iletişime geçebilirsiniz.</p>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 1.5rem; text-align: left; margin-top: 1.5rem; border-top: 1px solid var(--surface-border); padding-top: 2rem;">
          <div style="display: flex; align-items: center; gap: 1.25rem; background: rgba(255,255,255,0.02); padding: 1.25rem; border-radius: 12px; border: 1px solid var(--surface-border);">
            <span class="material-symbols-outlined text-accent" style="font-size: 2.25rem;">mail</span>
            <div>
              <strong style="display: block; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.2rem;">E-posta Adresi</strong>
              <a href="mailto:oguzzakg@gmail.com" style="color: white; font-size: 1.15rem; text-decoration: none; font-weight: 600; transition: color 0.2s;" onmouseover="this.style.color='#52b788'" onmouseout="this.style.color='white'">oguzzakg@gmail.com</a>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 1.25rem; background: rgba(255,255,255,0.02); padding: 1.25rem; border-radius: 12px; border: 1px solid var(--surface-border);">
            <span class="material-symbols-outlined text-accent" style="font-size: 2.25rem;">phone_iphone</span>
            <div>
              <strong style="display: block; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.2rem;">Telefon Numarası</strong>
              <a href="tel:05519406834" style="color: white; font-size: 1.15rem; text-decoration: none; font-weight: 600; transition: color 0.2s;" onmouseover="this.style.color='#52b788'" onmouseout="this.style.color='white'">0551 940 68 34</a>
            </div>
          </div>
        </div>
        
        <div style="margin-top: 2.5rem;">
          <a href="/" data-link class="btn btn-secondary" style="width: 100%; padding: 0.85rem;">Anasayfaya Dön</a>
        </div>
      </div>
    </div>
  `;
}

// Initial Routing
router();
