# Requirements Document

## Introduction

Bu özellik, FabricERP sistemindeki Super Admin panelini kapsamlı biçimde geliştirmeyi amaçlamaktadır. Geliştirme üç ana başlık altında ele alınmaktadır: (1) şirket detay sayfası ve kullanıcı yönetimi, (2) super admin bir şirket adına sisteme baktığında o şirkete özgü sol menü bağlamı, (3) davet kodu gerektirmeksizin doğrudan super admin panelinden yeni şirket oluşturma.

Mevcut sistemde super admin, `user.tenantId === null` koşuluyla tanımlanmaktadır. Backend NestJS + Prisma/PostgreSQL, frontend ise React + TypeScript + Tailwind ile geliştirilmiştir.

## Glossary

- **Super_Admin**: `tenantId` değeri `null` olan sistem yöneticisi kullanıcı.
- **Tenant**: Sistemde kayıtlı bir müşteri firma (şirket).
- **Impersonation_Context**: Super admin'in belirli bir tenant adına sistemi görüntülediği geçici çalışma modu.
- **Settings_Controller**: Backend'deki `/settings` endpoint'lerini yöneten NestJS kontrolörü.
- **Settings_Service**: Super admin işlemlerini uygulayan NestJS servis sınıfı.
- **Super_Admin_Panel**: Frontend'de `/superadmin` rotasında yer alan React sayfası.
- **Tenant_Detail_Page**: Belirli bir tenant'ın kullanıcılarını ve bilgilerini gösteren React sayfası.
- **MainLayout**: Sol menü ve üst navigasyon çubuğunu içeren React düzen bileşeni.

---

## Requirements

### Requirement 1: Şirket Detay Sayfası

**User Story:** Super Admin olarak, bir şirketin detay sayfasını açmak istiyorum; böylece o şirkete ait tüm bilgileri ve kullanıcıları tek ekranda görebilirim.

#### Acceptance Criteria

1. WHEN Super_Admin şirket listesindeki bir satıra tıkladığında, THE Super_Admin_Panel SHALL o tenant'a ait detay sayfasına yönlendirme yapmalıdır.
2. THE Tenant_Detail_Page SHALL tenant'ın ad, e-posta, telefon, adres, vergi dairesi, vergi numarası ve kayıt tarihini görüntülemelidir.
3. THE Tenant_Detail_Page SHALL o tenant'a ait kullanıcıları ad, e-posta, rol ve kayıt tarihi bilgileriyle listeleyen bir tablo içermelidir.
4. WHEN Super_Admin bir kullanıcının şifresini değiştirmek istediğinde, THE Tenant_Detail_Page SHALL yeni şifre girişine olanak tanıyan bir form sunmalıdır ve THE Settings_Service SHALL şifreyi bcrypt ile hash'leyerek kaydetmelidir.
5. WHEN Super_Admin bir kullanıcının e-postasını değiştirmek istediğinde, THE Tenant_Detail_Page SHALL bir düzenleme formu sunmalıdır ve THE Settings_Service SHALL yeni e-postanın sistemde benzersiz olduğunu doğrulamalıdır.
6. WHEN Super_Admin "Kullanıcı Ekle" formunu doldurup gönderdiğinde, THE Settings_Service SHALL belirtilen tenant'a yeni bir kullanıcı oluşturmalıdır.
7. WHEN Super_Admin bir kullanıcıyı silmek istediğinde, THE Tenant_Detail_Page SHALL onay diyalogu göstermeli ve THE Settings_Service SHALL onay alındıktan sonra kullanıcıyı veritabanından silmelidir.
8. IF Super_Admin paneline super admin yetkisi olmayan herhangi bir kullanıcı erişmeye çalışırsa (kimlik doğrulama sistemi durumundan bağımsız olarak), THEN THE Settings_Service SHALL 403 Forbidden hatası döndürmelidir.

---

### Requirement 2: Yeni Şirket Oluşturma

**User Story:** Super Admin olarak, davet kodu gerektirmeksizin doğrudan panelden yeni şirket oluşturmak istiyorum; böylece müşteri kaydını hızla tamamlayabilirim.

#### Acceptance Criteria

1. THE Super_Admin_Panel SHALL "Yeni Şirket Oluştur" düğmesi içermelidir.
2. WHEN Super_Admin yeni şirket formunu açtığında, THE Super_Admin_Panel SHALL en az şirket adı, admin kullanıcı e-postası ve admin kullanıcı şifresi alanlarını içeren bir form sunmalıdır.
3. WHEN Super_Admin formu gönderdiğinde, THE Settings_Service SHALL yeni bir Tenant kaydı ve bu tenant'a bağlı ADMIN rolünde bir User kaydı aynı veritabanı işlemi (transaction) içinde oluşturmalıdır.
4. IF gönderilen e-posta adresi sistemde zaten mevcutsa, THEN THE Settings_Service SHALL "Bu e-posta adresi zaten kullanımda." mesajıyla 400 Bad Request hatası döndürmelidir.
5. WHEN şirket başarıyla oluşturulduğunda ve şirket listesi başarıyla yenilendiğinde, THE Super_Admin_Panel SHALL kullanıcıya başarı bildirimi göstermelidir.
6. THE Settings_Service SHALL yeni oluşturulan Admin kullanıcısının şifresini bcrypt ile en az 10 round (yapılandırılabilir, minimum 10) kullanarak hash'lemelidir.

---

### Requirement 3: Impersonation (Şirket Bağlamında Görüntüleme)

**User Story:** Super Admin olarak, bir şirketi seçip o şirketin ERP panelini sanki o firmanın yöneticisiymişim gibi görüntülemek istiyorum; böylece destek ve sorun giderme işlemlerini kolayca yapabilirim.

#### Acceptance Criteria

1. THE Tenant_Detail_Page SHALL her şirket için "Bu Şirket Adına Görüntüle" düğmesi içermelidir.
2. WHEN Super_Admin "Bu Şirket Adına Görüntüle" düğmesine tıkladığında, THE MainLayout SHALL sol menüde standart ERP menüsünü (Dashboard, Cari Hesaplar, İplik Envanteri vb.) Impersonation_Context aktif tenant'ı için göstermelidir.
3. WHILE Impersonation_Context aktifken, THE MainLayout SHALL üst çubukta veya sidebar'da hangi firmanın bağlamında çalışıldığını belirten bir banner/gösterge sunmalıdır.
4. WHILE Impersonation_Context aktifken, THE MainLayout SHALL "Süper Admin Paneline Dön" düğmesini erişilebilir konumda göstermeli; düğmeye tıklandıktan sonra impersonation tam olarak sona erene kadar düğme görünür kalmaya devam etmelidir.
5. WHEN Super_Admin "Süper Admin Paneline Dön" düğmesine tıkladığında, THE MainLayout SHALL Impersonation_Context'i sona erdirerek `/superadmin` rotasına yönlendirmelidir ve sol menü Super_Admin görünümüne dönmelidir.
6. WHILE Impersonation_Context aktifken, THE Super_Admin_Panel SHALL API isteklerinin hedef tenant'ın verilerini döndürmesini sağlamalıdır; bu amaçla frontend, ilgili API isteklerinde impersonated tenant ID'sini `X-Impersonate-Tenant` HTTP başlığı olarak iletmelidir.
7. THE Settings_Controller SHALL `X-Impersonate-Tenant` başlığı mevcut olduğunda ve istekte bulunan kullanıcı Super_Admin ise, tenant-scoped sorgularda bu başlıktaki ID'yi kullanmalıdır.

---

### Requirement 4: Backend Güvenlik ve Doğrulama

**User Story:** Super Admin olarak, tüm super admin işlemlerinin yalnızca yetkili kullanıcılara açık olmasını istiyorum; böylece sistemin bütünlüğü korunur.

#### Acceptance Criteria

1. THE Settings_Service SHALL super admin gerektiren her endpoint'te çağrının `tenantId === null` olan bir kullanıcıdan geldiğini doğrulamalıdır.
2. WHEN Settings_Service bir kullanıcının e-postasını güncellerken, THE Settings_Service SHALL e-posta alanının boş olmadığını ve geçerli RFC 5322 e-posta formatında olduğunu doğrulamalıdır.
3. WHEN Settings_Service bir kullanıcının şifresini güncellerken, THE Settings_Service SHALL yeni şifrenin en az 6 karakter uzunluğunda olduğunu doğrulamalıdır.
4. IF herhangi bir super admin işlemi sırasında veritabanı hatası oluşursa, THEN THE Settings_Service SHALL işlemi geri almayı denemeli (rollback) ve rollback başarılı olsa da olmasa da açıklayıcı bir hata mesajı döndürmelidir.
5. THE Settings_Service SHALL kullanıcı silme işleminde hedef kullanıcının istekte bulunan super admin'in kendisi olmadığını doğrulamalıdır.
