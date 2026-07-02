# FabricERP - Üretim & Stok Takip Sistemi Kurulum Kılavuzu

Bu kılavuz, FabricERP sisteminin müşterinizin sunucusuna veya yerel ağına (local) kurulması için gereken tüm adımları içermektedir. Sistem; **Frontend (React+Vite)**, **Backend (NestJS)**, **FastAPI (PaddleOCR)**, **Redis** ve **PostgreSQL** (veya bulut tabanlı Neon DB) bileşenlerinden oluşur.

---

## 🚀 1. Önerilen Altyapı Mimarisi

Müşterilerinize kurulum yaparken kullanabileceğiniz **iki ana yöntem** vardır:

### Seçenek A: Bulut VPS Üzerinde Kurulum (En Çok Önerilen)
* **Nasıl Çalışır:** DigitalOcean, Hetzner, AWS veya yerel bir bulut sağlayıcıdan (örn. aylık 5-10$ seviyesinde) bir **Ubuntu VPS** kiralanır. Tüm sistem Docker Compose ile bu sunucuda çalıştırılır.
* **Avantajları:**
  - Fabrika dışından (mobil cihazlar, evden, yöneticiler tarafından) kolay erişim.
  - SSL (HTTPS) sertifikası kurulumu çok kolaydır (Let's Encrypt ile ücretsiz).
  - Yedekleme ve sunucu yönetimi basittir.

### Seçenek B: Yerel Ağ (Lokal Fabrika İçi Sunucu) Kurulumu
* **Nasıl Çalışır:** Fabrika içerisine yerleştirilen bir Mini-PC veya sunucuya (Windows/Ubuntu) Docker kurulur. Cihazlar lokal IP üzerinden (örn. `http://192.168.1.100`) sisteme erişir.
* **Avantajları:** İnternet kesilse dahi sistem çalışmaya devam eder.
* **Kritik Uyarısı:** Tarayıcıların güvenlik politikaları nedeniyle **kamera ile OCR okuma (kamera açma) özelliği localhost dışındaki bağlantılarda yalnızca HTTPS (SSL) protokolü altında çalışır**. Lokal kurulum yapıldığında kamera özelliğinin çalışması için yerel ağda SSL yapılandırması ya da Ngrok/Cloudflare tüneli kullanılması zorunludur.

---

## 💾 2. Neon DB (Veritabanı) Yönetimi ve Yapılandırma

Müşterilerinizin veritabanını yönetmek için en mantıklı yaklaşım şudur:

1. **Ayrı Neon Hesabı:** Her müşteri için Neon DB üzerinde ayrı bir proje (veya aynı Neon hesabı altında ayrı projeler/veritabanları) açın.
2. **Yönetim:** Neon DB ücretsiz planda geliştirme için yeterli alan sunsa da, canlı üretim ortamında verilerin silinmemesi ve performans için **Launch (aylık $19)** paketine geçilmesi veya yerel veritabanı kullanılması önerilir.
3. **Admin Yetkisi:** Müşterinin Neon projesine kendi e-postanızı **Member/Admin** olarak ekleyerek veritabanını uzaktan yönetebilir, yedek alabilir ve şema güncellemelerini yansıtabilirsiniz.

---

## 🛠️ 3. Sunucu Hazırlığı (Ubuntu VPS)

Ubuntu işletim sistemli yeni bir sunucuda aşağıdaki adımları sırayla uygulayın:

### Adım 1: Sunucuyu Güncelleyin
```bash
sudo apt update && sudo apt upgrade -y
```

### Adım 2: Docker ve Docker Compose Kurulumu
```bash
# Docker kurulumu
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Kullanıcıyı docker grubuna ekleme (sudo yazmadan çalıştırmak için)
sudo usermod -aG docker $USER
newgrp docker

# Docker Compose kurulumu
sudo apt install docker-compose-plugin -y
```

### Adım 3: Git Kurulumu
```bash
sudo apt install git -y
```

---

## 📦 4. Docker Compose ile Tek Adımda Kurulum

Projeyi sunucuya kopyaladıktan sonra ana dizinde bulunan `docker-compose.yml` dosyasını kullanarak tüm servisleri tek seferde ayağa kaldırabilirsiniz.

### Adım 1: Projeyi Sunucuya Çekin
```bash
git clone <sizin-repo-adresiniz> fabricerp
cd fabricerp
```

### Adım 2: Ortam Değişkenlerini Tanımlayın
`backend` klasörü içinde `.env` dosyası oluşturun:
```bash
nano backend/.env
```
İçeriğini müşterinin bilgilerine göre düzenleyin:
```env
# Neon DB veya Yerel Postgres Bağlantısı
# Yerel Postgres için: postgresql://postgres:postgres_password@postgres:5432/fabricerp?schema=public
# Neon DB için:
DATABASE_URL="postgresql://[kullanici]:[sifre]@[neon-host]/[db_adi]?sslmode=require"

JWT_SECRET="guclu-bir-random-secret-key-yaziniz"
PORT=3001
NODE_ENV=production
OCR_SERVICE_URL=http://ocr-service:8000/ocr
```

### Adım 3: Docker Konteynerlarını Derleyin ve Çalıştırın
Ana dizinde aşağıdaki komutu çalıştırarak frontend, backend, fastapi ocr, redis ve postgres servislerini başlatın:
```bash
docker compose up -d --build
```
*Bu komut frontend'i Nginx ile derler, backend'i hazırlar, OCR servisi için gerekli python kütüphanelerini yükler ve arka planda çalıştırır.*

### Adım 4: Veritabanı Tablolarını Oluşturun (Prisma Migration)
Konteynerlar ayağa kalktıktan sonra Prisma şemasını veritabanına uygulamak için:
```bash
docker compose exec backend npx prisma migrate deploy
```

---

## 🔒 5. Nginx Reverse Proxy ve SSL (HTTPS) Kurulumu

Kamera tarama özelliğinin sorunsuz çalışması için sunucunuza SSL kurmanız gerekir. Bunun için sunucuya **Nginx** ve **Certbot** kurarak trafiği yönlendirelim.

### Adım 1: Nginx Kurulumu
```bash
sudo apt install nginx -y
```

### Adım 2: Nginx Yapılandırması
Yeni bir site yapılandırması oluşturun:
```bash
sudo nano /etc/nginx/sites-available/fabricerp
```
Aşağıdaki yapılandırmayı yapıştırın (`panel.musteridomain.com` kısmını müşterinin alan adı ile değiştirin):
```nginx
server {
    listen 80;
    server_name panel.musteridomain.com;

    location / {
        proxy_pass http://localhost:80; # Docker frontend portu
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Yapılandırmayı aktifleştirin ve Nginx'i yeniden başlatın:
```bash
sudo ln -s /etc/nginx/sites-available/fabricerp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Adım 3: Let's Encrypt ile Ücretsiz SSL (HTTPS) Kurulumu
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d panel.musteridomain.com
```
*Ekrana gelen yönergeleri takip edin ve HTTP trafiğini HTTPS'e otomatik yönlendirme (Redirect) seçeneğini seçin.*

Artık sisteminiz `https://panel.musteridomain.com` adresi üzerinden tamamen güvenli ve kameralar aktif şekilde çalışmaya hazırdır!

---

## 🔄 6. Güncelleme (Update) Yönetimi

Uygulamada bir değişiklik yaptığınızda müşterinin sunucusunu güncellemek oldukça basittir:

1. Kendi bilgisayarınızda kodu değiştirin ve Git deposuna push edin.
2. Müşteri sunucusuna SSH ile bağlanın ve proje dizinine gidin.
3. Aşağıdaki komutları sırasıyla çalıştırın:
```bash
# En son kodları çekin
git pull

# Konteynerları yeniden derleyin ve arka planda başlatın
docker compose up -d --build

# Eğer veritabanı şemasında (Prisma) değişiklik varsa uygulayın
docker compose exec backend npx prisma migrate deploy
```
Bu adımlar sayesinde sistem sadece birkaç saniyelik kesinti ile en güncel sürüme yükseltilmiş olur.
