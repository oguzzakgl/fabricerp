# 🧶 FabricERP - Tekstil Üretim & Stok Takip Sistemi

FabricERP, tekstil üreticilerinin kumaş stoklarını, cari hesaplarını, irsaliyelerini ve üretim süreçlerini modern ve verimli bir şekilde yönetmesini sağlayan web tabanlı bir Kurumsal Kaynak Planlama (ERP) yazılımıdır. 

Sistem, yapay zeka destekli (Gemini Multimodal) gelişmiş bir OCR altyapısı barındırır. Bu sayede kumaş etiketleri kamera veya galeri yoluyla okutularak sisteme saniyeler içinde hatasız bir şekilde kaydedilebilir.

---

## ✨ Öne Çıkan Özellikler

* **📦 Kumaş ve Stok Takibi:** Kumaş türleri, stok miktarları, rulo detayları ve hareket geçmişi.
* **📷 Gemini Yapay Zeka Destekli OCR:** Kumaş üzerindeki etiket görsellerini OpenCV/CLAHE ile ön işleme tabi tutup, Google Gemini Multimodal API aracılığıyla yüksek doğrulukla ve hızla dijital verilere dönüştürme.
* **🧾 İrsaliye & Cari Yönetimi:** Müşteri/tedarikçi cari hesapları, irsaliye giriş-çıkışları ve stok entegrasyonu.
* **🔒 Güvenli Yetkilendirme (RBAC):** Çoklu tenant desteği, JWT tabanlı oturum yönetimi ve kullanıcı rol yetkilendirmeleri (Superadmin, Admin, User).
* **📈 Hata İzleme & Analitik:** 
  - **Sentry:** Backend (NestJS) ve Frontend (React) üzerinde gerçek zamanlı hata yakalama ve izleme.
  - **Microsoft Clarity:** Kullanıcı oturum kayıtları ve ısı haritaları ile kullanıcı deneyimi analitiği.
* **🐳 Docker Desteği:** Tek komutla tüm uygulamayı (Frontend, Backend, OCR, Veritabanı) ayağa kaldırabilme.

---

## 🛠️ Teknoloji Yığını (Tech Stack)

### Arayüz (Frontend)
* **Framework:** React + Vite (TypeScript)
* **Tasarım / UI:** Ant Design (Antd), TailwindCSS, Özel CSS Tema (Koyu/Aydınlık Mod)
* **İzleme:** `@sentry/react` ve Microsoft Clarity SDK

### Sunucu (Backend)
* **Framework:** NestJS (TypeScript)
* **ORM:** Prisma ORM
* **Güvenlik / Auth:** Passport.js (JWT Strategy)
* **İzleme:** `@sentry/nestjs` ve `@sentry/profiling-node`

### Yapay Zeka & OCR Servisi
* **Framework:** FastAPI (Python 3.10+)
* **Görüntü İşleme:** OpenCV (Grayscale, CLAHE kontrast iyileştirme, keskinleştirme), PIL
* **Model:** Google Gemini Pro Vision / Gemini Multimodal API

### Altyapı & Veritabanı
* **Veritabanı:** PostgreSQL (Neon DB veya Yerel Postgres)
* **Önbellek:** Redis
* **Konteynerleştirme:** Docker & Docker Compose
* **Proxy / Yönlendirici:** Node.js tabanlı Proxy ve Nginx (SSL/HTTPS için)

---

## 📁 Proje Yapısı

```text
fabricerp/
├── backend/            # NestJS Backend Uygulaması
│   ├── src/            # Kaynak Kodları (Auth, Prisma, Rolls, Accounts, vb.)
│   └── prisma/         # Prisma Şemaları ve Migrations
├── frontend/           # React + Vite Frontend Uygulaması
│   ├── src/            # Kaynak Kodları (Pages, Components, Contexts, vb.)
│   └── public/         # Statik Varlıklar
├── ocr_service.py      # FastAPI OCR Servisi (Gemini API & Görsel Ön İşleme)
├── start-all.js        # Geliştirme Ortamında Tüm Servisleri Başlatıcı Script
├── proxy.js            # Servisler Arası Yönlendirici Proxy
├── docker-compose.yml  # Canlı Ortam Docker Dağıtım Dosyası
└── KURULUM_REHBERI.md  # Detaylı Canlı Sunucuya Dağıtım Rehberi
```

---

## 🚀 Yerel Geliştirme Kurulumu (Local Development)

Sistemi yerel makinenizde çalıştırmak için aşağıdaki adımları izleyin:

### 1. Gereksinimler
* **Node.js** (v18+)
* **Python** (v3.10+)
* **PostgreSQL** (veya Neon DB hesabı)
* **Google Gemini API Anahtarı** (OCR özelliğinin çalışması için)

### 2. Ortam Değişkenleri (.env)
Hem backend hem de frontend dizinlerinde gerekli yapılandırmaları yapın.

#### Backend Yapılandırması (`backend/.env`):
```env
DATABASE_URL="postgresql://[kullanici]:[sifre]@[host]/[db_adi]?sslmode=require"
JWT_SECRET="kendi_guclu_secret_anahtariniz"
PORT=3001
NODE_ENV=development
OCR_SERVICE_URL="http://127.0.0.1:8000/ocr"
SENTRY_DSN="https://your-sentry-dsn"
```

#### Frontend Yapılandırması (`frontend/.env`):
```env
VITE_API_URL="http://localhost:3001"
VITE_SENTRY_DSN="https://your-sentry-dsn"
VITE_CLARITY_ID="xf9p3pryei"
```

### 3. Bağımlılıkların Yüklenmesi
Ana dizinde NPM bağımlılıklarını kurun:
```bash
npm install
```

Backend ve Frontend bağımlılıklarını ayrı ayrı yükleyin:
```bash
cd backend && npm install
cd ../frontend && npm install
cd ..
```

Python sanal ortamını (`.venv`) oluşturup OCR kütüphanelerini kurun:
```bash
python -m venv .venv
# Windows için:
.venv\Scripts\activate
# Linux/macOS için:
source .venv/bin/activate

pip install -r requirements.txt
```

### 4. Veritabanı Şemasını Uygulama
Prisma şemasını veritabanına uygulayarak tabloları oluşturun:
```bash
cd backend
npx prisma db push
cd ..
```

### 5. Çalıştırma
Tüm projeyi (Frontend, Backend, OCR ve Proxy) tek bir komutla başlatmak için ana dizinde şu komutu çalıştırın:
```bash
node start-all.js
```
Bu komut sırasıyla:
* **FastAPI OCR** servisini `http://127.0.0.1:8000` portunda,
* **NestJS Backend** servisini `http://127.0.0.1:3001` portunda,
* **React Frontend** servisini `http://127.0.0.1:5173` portunda başlatır.

---

## 🐳 Canlı Ortama Dağıtım (Production)

Canlı ortam dağıtımı, sunucunuza kolayca kurulabilmesi için **Docker Compose** ile optimize edilmiştir. 

Müşteri sunucusuna veya bulut VPS'e SSL (HTTPS) kurarak kameradan OCR tarama özelliğini aktif etmek de dahil olmak üzere adım adım canlı kurulum talimatları için lütfen **[KURULUM_REHBERI.md](file:///c:/Users/ouz/Desktop/fabricerp/KURULUM_REHBERI.md)** dosyasını inceleyin.

---

## 📈 İzleme ve Teşhis

* **Hata İzleme (Sentry):** Hatalar otomatik olarak Sentry paneline düşer. Geliştirme ortamında test etmek için frontend konsolundan hata tetikleyebilirsiniz.
* **Kullanıcı Analizi (Microsoft Clarity):** Kullanıcıların arayüzdeki hareketleri, tıklama ısı haritaları ve oturum kayıtları Clarity paneli üzerinden izlenebilir.
* **OCR Hızlandırma:** OCR motoru gönderilen görselleri otomatik olarak optimize ederek (`CLAHE` kontrast iyileştirme, `grayscale` dönüşüm, max `600px` genişlik ve `%65 WebP` sıkıştırma) ağ üzerinden aktarılan veriyi minimuma indirir ve Gemini okuma hızını maksimuma çıkarır.
