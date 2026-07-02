# Google Cloud Run & Firebase Bulut Yayınlama Rehberi

Bu rehber, projenizi Google Cloud Run (Backend & OCR) ve Firebase Hosting (Frontend) kullanarak **tamamen ücretsiz limitler (Free Tier)** dahilinde canlı ortama deploy etmenizi sağlar.

---

## 🛠️ ADIM 1: Google Cloud SDK (gcloud CLI) Kurulumu

Bilgisayarınızda `gcloud` komutunun çalışabilmesi için Google Cloud SDK aracını kurmanız gerekir:

1. **İndirin ve Kurun:**
   * [Google Cloud SDK Windows Kurulum Dosyası](https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe) linkine tıklayarak kurulum dosyasını indirin ve standart adımlarla kurun.
2. **Giriş Yapın (Login):**
   * Terminali kapatıp yeniden açın ve şu komutu çalıştırıp açılan tarayıcı ekranından Google hesabınızla giriş yapın:
     ```bash
     gcloud auth login
     ```
3. **Projenizi Seçin:**
   * console.cloud.google.com üzerinde açık olan projenizin **Project ID (Proje ID)** bilgisini kopyalayın ve terminale girin:
     ```bash
     gcloud config set project [PROJE_ID_NIZ]
     ```

---

## 🚀 ADIM 2: OCR Servisini Cloud Run'a Deploy Etmek

OCR servisi (FastAPI) Docker konteyneri olarak Cloud Run'a yüklenecektir.

1. Terminalde `ocr` dizinine girin:
   ```bash
   cd ocr
   ```
2. Cloud Run'a doğrudan kaynak koddan deploy edin (GCP arkada otomatik Docker build yapacaktır. PaddleOCR'ın düzgün çalışması için minimum 2Gi RAM tanımlıyoruz):
   ```bash
   gcloud run deploy rollflow-ocr --source . --region europe-west3 --allow-unauthenticated --memory 2Gi --cpu 1 --timeout 300
   ```
   * *Not: `europe-west3` Frankfurt lokasyonudur ve Türkiye'ye en yakın Google veri merkezlerinden biridir.*
3. Komut tamamlandığında size bir **Service URL** verecektir (Örn: `https://rollflow-ocr-xxxxx.run.app`). Bu adresi kopyalayın, backend ayarlarında kullanacağız.
4. Kök dizine geri dönün:
   ```bash
   cd ..
   ```

---

## ⚙️ ADIM 3: Backend Servisini Cloud Run'a Deploy Etmek

Backend (NestJS) sunucusu deploy edilmeden önce Prisma veritabanı şemasının canlı Neon DB'ye migrate edildiğinden emin olunmalıdır.

1. `backend/.env` dosyasındaki `DATABASE_URL`'in canlı Neon veritabanı adresi olduğundan emin olun.
2. `backend` dizinine girin:
   ```bash
   cd backend
   ```
3. Veritabanını canlıya migrate edin (eğer yerel geliştirme dışındaysa):
   ```bash
   npx prisma db push
   ```
4. Backend'i Cloud Run'a deploy edin:
   ```bash
   gcloud run deploy rollflow-backend --source . --region europe-west3 --allow-unauthenticated --set-env-vars DATABASE_URL="postgresql://neondb_owner:...",JWT_SECRET="super_secret...",OCR_SERVICE_URL="[ADIM_2_DEKI_OCR_URL]/ocr"
   ```
   * *Not: `--set-env-vars` parametresi ile `.env` dosyasındaki canlı DB URL, JWT şifresi ve ADIM 2'de elde ettiğiniz OCR URL adresini çevre değişkeni olarak sunucuya tanımlıyoruz.*
5. Komut bittiğinde size backend için bir **Service URL** verecektir (Örn: `https://rollflow-backend-xxxxx.run.app`). Bu adresi kopyalayın, frontend derlemesinde kullanacağız.
6. Kök dizine geri dönün:
   ```bash
   cd ..
   ```

---

## 🎨 ADIM 4: Frontend Servisini Netlify ile Yayınlamak

Statik dosyalarımızın Cloud Run kotalarını tüketmemesi ve tamamen ücretsiz yayınlanması için Netlify kullanacağız.

1. **Netlify CLI Kurulumu:**
   ```bash
   npm install -g netlify-cli
   ```
2. **Netlify Giriş Yapın:**
   ```bash
   netlify login
   ```
   * *Açılan tarayıcı ekranından Netlify hesabınıza giriş yapın.*
3. **Frontend API URL Güncellemesi:**
   * `frontend/.env` (veya config dosyası) içerisindeki API URL adresini, ADIM 3'te aldığınız backend servis URL'si olarak güncelleyin.
4. **Projeyi Derleyin (Build):**
   ```bash
   cd frontend
   npm run build
   ```
5. **Deploy Edin:**
   ```bash
   netlify deploy --dir=dist --prod
   ```
   * *Sorulan sorularda:*
     * "Create & configure a new site" (Yeni site oluştur) seçeneğini seçin.
     * Ekran adımlarını onaylayın.
6. Size verilen canlı web site adresi (Örn: `https://[MARKA-ADI].netlify.app`) üzerinden artık sisteme erişebilirsiniz!
