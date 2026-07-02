Faz Modül / Görev Kapsam ve Kritik Noktalar (Google Cloud Detayı)
Faz 1 Temel Veri Yönetimi Cloud SQL for PostgreSQL üzerinde accounts ve yarn_stocks tablolarının oluşturulması. Backend (Cloud Run) ile CRUD işlemleri. İplik girişinde tedarikçi seçimi için Cari modali. Bakiye hesaplaması henüz yapılmaz. Cloud SQL’e özel IP ve VPC Connector üzerinden bağlanılır.
Faz 2 Üretim ve Mamul Stok Kumaş modülü. Backend (Cloud Run) üzerinde üretim reçetesi motoru: atkı/çözgü ipliği seçimleri Cloud SQL’de transaction içinde gerçekleşir. Maliyet hesaplanır, rolls tablosuna yazılır. İplik stok düşümü aynı transaction’da yapılır; stok yetersizse ROLLBACK. Barkod verisi benzersiz olarak tutulur.
Faz 3 Sipariş ve Stok Rezervasyonu Sipariş modülü. Cari seçimi ve kumaş topu seçimi modal akışları. Backend’de PostgreSQL pessimistic locking (SELECT ... FOR UPDATE) ile aynı topun iki kez satılması engellenir. Toplar reserved durumuna alınır. Memorystore for Redis ile reservation timeout yönetimi (örn. 30 dk sonra serbest bırakma).
Faz 4 Finans ve Faturalandırma Fatura modülü (siparişten veri transferi) ve Finans modülü. Tüm işlemler Cloud SQL transaction’ları ile cari bakiyeyi günceller. invoices ve financial_transactions tabloları devreye girer. Cloud Storage’a fatura PDF/UBL yükleme.
Faz 5 Komuta Merkezi ve Analitik Dashboard. Cloud Scheduler + Cloud Run Jobs ile Materialized View’ler periyodik olarak yenilenir. Özet veriler Memorystore cache’inde tutulur. Widget’lardan UUID ile derin bağlantı navigasyonu. Cloud CDN önünde hızlı yükleme.
Faz 6 Kullanıcı Yönetimi ve Denetim RBAC, giriş, Audit Log. Cloud SQL’de audit_logs tablosu. Hassas bilgiler Secret Manager’da saklanır. Cloud Monitoring ve Cloud Logging ile sistem olayları izlenir. 2. Veritabanı Şeması (Cloud SQL for PostgreSQL)
Tüm tablolar Google Cloud SQL for PostgreSQL üzerinde bulunur. Bağlantı VPC Connector ile özel IP üzerinden sağlanır, dış dünyaya kapalıdır. Anahtar alanlar UUID’dir.

accounts – Cari hesaplar. Bakiye doğrudan saklanmaz; fatura ve finans tablolarından materialized view ile hesaplanır.

yarn_stocks – İplik envanteri. current_kg alanı negatif olamaz; kısıt uygulama katmanında veya trigger ile kontrol edilir.

rolls – Kumaş topları. status alanı üzerinden race condition kontrolü yapılır. cost_price, production_recipes tablosu üzerinden transaction içinde hesaplanır.

production_recipes – Üretim reçetesi. Atkı/çözgü ipliği ve kullanılan kg bilgisi. Maliyet formülü: (warp_kg _ unit_price) + (weft_kg _ unit_price).

orders / order_items – Siparişler. order_items.roll_id sütununda unique constraint bulunur.

invoices – Faturalar. Kalemler invoice_items alt tablosunda veya JSONB olarak tutulabilir. Fatura dosyaları Cloud Storage bucket’ına kaydedilir, tabloya yalnızca dosya yolu (örn. gs://bucket-name/invoices/...) yazılır.

financial_transactions – Çek, senet, nakit hareketler. Statü değişiminde cari bakiyeyi güncellemek için veritabanı seviyesinde transaction kullanılır.

Destekleyici Tablolar: audit_logs, users/roles/permissions, dashboard_cache (alternatif olarak Redis’te tutulur).

3. Kullanılacak Teknoloji Yığını (Google Cloud Ağırlıklı)
   Bileşen Seçim Açıklama
   Backend Python (Django) veya Node.js (NestJS) Cloud Run üzerinde konteyner olarak çalışır. Otomatik ölçeklenir, trafiğe göre sıfıra inebilir.
   Frontend React + Ant Design Firebase Hosting veya Cloud Storage + Cloud CDN ile sunulur. SSL otomatik.
   Veritabanı Cloud SQL for PostgreSQL Yedekli, özel IP erişimi, otomatik yedekleme.
   Önbellek / Kuyruk Memorystore for Redis Cache, oturum yönetimi, BullMQ/Celery kuyruğu için.
   Dosya Depolama Cloud Storage Fatura PDF/XML, kullanıcı yüklemeleri. İmzalı URL’ler ile güvenli erişim.
   Zamanlanmış İşler Cloud Scheduler + Cloud Run Jobs Dashboard özet yenileme, zaman aşımına uğrayan rezervasyonları serbest bırakma.
   CI/CD Cloud Build + GitHub cloudbuild.yaml ile otomatik imaj build ve Cloud Run deploy.
   Gizli Anahtar Yönetimi Secret Manager DB şifresi, API anahtarları burada saklanır, Cloud Run’a secret olarak enjekte edilir.
   İzleme & Loglama Cloud Monitoring, Cloud Logging Uptime check, hata takibi, performans metrikleri. Sentry entegrasyonu opsiyonel.
   Domain & CDN Cloud Domains + Cloud Load Balancing / Firebase SSL sertifikası otomatik yönetilir.
4. Tüm Sayfalar ve Sayfa Detayları (Google Cloud Bağlamıyla)
   4.1. Kimlik Doğrulama ve Ana Çerçeve
   Giriş Sayfası: Kullanıcı bilgileri Cloud SQL’deki users tablosunda tutulur. Kimlik doğrulama JWT tabanlıdır; secret key Secret Manager’dan alınır.

Ana Layout: Sabit sidebar. Menü öğeleri aynı sırayla (Dashboard, Cari, İplik, Kumaş, Sipariş, Fatura, Finans). Sayfalar Cloud Run’daki API ile iletişim kurar.

4.2. Dashboard
Veriler Cloud Scheduler ile güncellenen materialized view veya Redis cache’ten okunur.

Vadesi yaklaşan çek/senet satırı tıklandığında, /finans?uuid=… yönlendirmesi yapılır. Bu bilgi Cloud SQL’den anlık sorgulanır.

Kritik stok uyarıları yarn_stocks tablosundaki anlık veriyle oluşturulur, tıklama /yarn-stocks sayfasını açar.

4.3. Cari Hesaplar
Liste: ProTable sunucu taraflı sayfalama. Bakiye bilgisi materialized view’den gelir (hesaplama yükü azaltılır).

Detay Sayfası: Sekmelerdeki sipariş, fatura, finans listeleri Cloud SQL’den talep anında çekilir.

Hızlı Aksiyonlar: “Yeni Sipariş” butonu, Cari ID’sini pre-filled olarak taşır ve /orders/new?customer_id=... adresine yönlendirir.

4.4. İplik Envanteri
Giriş modalı: Tedarikçi seçimi, Cari Hesaplar modali ile yapılır. Modaldaki veri Cloud SQL’den çekilir.

Kaydetme anında current_kg = initial_kg yazılır, Cloud SQL trigger ile stok hareketi loglanır.

4.5. Kumaş Envanteri
Yeni Kumaş Girişi: Üretim reçetesi drawer’ı açılır. İplik seçimleri için İplik Envanteri modali, sadece current_kg > 0 olanları listeleyen API’yi (Cloud Run) kullanır.

Kaydetme sırasında backend (Cloud Run), Cloud SQL transaction başlatır:

rolls oluşturulur.
production_recipes oluşturulur.
yarn_stocks.current_kg güncellenir.
Herhangi bir adım başarısız olursa transaction rollback yapılır, kullanıcıya hata döner.
4.6. Sipariş Yönetimi
Yeni Sipariş sayfası: Müşteri seçimi Cari modali ile. Kumaş ekleme modali sadece status='available' ve quality='1' topları gösterir; bu filtre API tarafında uygulanır.

Pessimistic locking: Backend, SELECT ... FOR UPDATE ile topları kilitler, status’u reserved yapar. Memorystore’da bir anahtar ile rezervasyon süresi tutulur; Cloud Scheduler zaman aşımına uğrayanları serbest bırakır.

Onaylama ile toplar sold durumuna geçer.

4.7. Faturalandırma
Fatura oluşturma: Siparişten gelen veriler read-only yüklenir. Vergi hesaplaması anlık yapılır.

Kaydetme anında Cloud SQL transaction ile:

Fatura ve kalemleri kaydedilir.

İlgili orders kaydı invoiced olur.

Cari bakiyeyi güncelleyen financial_transactions kaydı oluşturulur.

e-Fatura PDF/UBL: Dosya Cloud Storage bucket’ına yüklenir, tabloda dosya yolu saklanır. Önizleme için imzalı URL oluşturulur.

4.8. Finans (Çek/Senet)
Liste: Portföy Cloud SQL’den sunucu taraflı sayfalamayla alınır.

Yeni Giriş: Cari seçimi modal ile. Kayıt pending olarak oluşturulur.

Tahsil Et: Modalda tahsilat bilgileri girilir. Kaydedildiğinde backend transaction ile:

Evrak durumu collected olur.

Cari hesap hareketi işlenir (alacak/borç güncellenir).

Tüm işlem Cloud SQL’de atomik olarak gerçekleşir, tutarlılık garantidir.

5. Google Cloud’a Özgü Ek Mimarî Notlar
   Ağ ve Güvenlik: Backend (Cloud Run) ve veritabanı (Cloud SQL) arasında yalnızca özel IP kullanılır. Cloud Run’a bir VPC Connector tanımlanır. Cloud SQL’e dış IP üzerinden erişim tamamen kapalıdır.

Secret Manager: Veritabanı bağlantı dizesi, Redis parolası, JWT secret gibi değerler ortam değişkeni olarak değil, secret referansı olarak Cloud Run’a verilir.

CI/CD: cloudbuild.yaml ile GitHub’daki her main push’unda Docker imajı oluşturulur, Artifact Registry’ye pushlanır, ardından gcloud run deploy ile güncellenir.

Maliyet optimizasyonu: Cloud Run, talep yokken sıfıra ölçeklenebilir. Cloud SQL ve Memorystore sabit ücrete tabidir, başlangıç için en düşük planlar seçilmelidir.

Yedekleme: Cloud SQL otomatik günlük yedekleme yapar. Cloud Storage bucket’ında versiyonlama açılabilir.
