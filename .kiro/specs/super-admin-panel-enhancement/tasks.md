# Implementation Tasks: Super Admin Panel Enhancement

## Task 1: Backend - New Super Admin Endpoints
Add the following endpoints to `backend/src/settings/settings.service.ts` and `settings.controller.ts`:

### 1a: superCreateTenant
POST /api/settings/super/tenants
- Body: { tenantName: string, adminEmail: string, adminPassword: string }
- Creates Tenant + ADMIN User in a single transaction (no invite code needed)
- Hash password with bcrypt(10)
- Return: created tenant with users

### 1b: superGetTenant (single tenant detail)
GET /api/settings/super/tenants/:id
- Returns full tenant info + users list (id, name, email, role, createdAt)

### 1c: superUpdateUserPassword
PATCH /api/settings/super/users/:id/password
- Body: { newPassword: string } (min 6 chars)
- bcrypt hash then update

### 1d: superUpdateUserEmail
PATCH /api/settings/super/users/:id/email
- Body: { newEmail: string }
- Validate uniqueness

### 1e: superAddUserToTenant
POST /api/settings/super/tenants/:tenantId/users
- Body: { name: string, email: string, password: string, role: string }
- Creates user assigned to that tenant

### 1f: superDeleteUser
DELETE /api/settings/super/users/:id
- Cannot delete self

All endpoints must verify caller has tenantId === null (super admin check).

## Task 2: Frontend - MainLayout Sidebar Update
Update `frontend/src/components/MainLayout.tsx`:

The super admin menu items should be added at the bottom of the sidebar with a visual separator, ONLY when user.tenantId === null.

Current menuItems array has 8 items. Keep those. Then add:
- A divider/separator section labeled "SÜPERADMİN" 
- { path: '/superadmin', label: 'Admin Dashboard', icon: 'admin_panel_settings' }
- { path: '/superadmin/tenants', label: 'Müşteri Firmalar', icon: 'corporate_fare' }
- { path: '/superadmin/users', label: 'Kullanıcı Hesapları', icon: 'manage_accounts' }
- { path: '/superadmin/invites', label: 'Davet Kodları', icon: 'vpn_key' }

The sidebar section label "SÜPERADMİN" should be a small uppercase gray label (not a button), acting as a visual separator between the two groups.

Also update getHeaderTitle() to include titles for new routes.

## Task 3: Frontend - SuperAdmin Pages Restructure
Restructure `frontend/src/pages/SuperAdmin/` into multiple sub-pages:

### Task 3a: SuperAdmin Dashboard (/superadmin)
File: `frontend/src/pages/SuperAdmin/index.tsx`
- Show 3 stat cards (tenants, users, invites counts)
- Show recent tenants table (last 5) with "Detay Gör" button linking to /superadmin/tenants/:id
- "Yeni Şirket Oluştur" button that opens a modal
- Modal fields: Şirket Adı, Admin E-posta, Admin Şifre

### Task 3b: Tenants List Page (/superadmin/tenants)
File: `frontend/src/pages/SuperAdmin/Tenants.tsx`
- Full tenants table: Firma Adı, E-posta, Telefon, Kayıt Tarihi, Kullanıcı Sayısı, "Detay Gör →" button
- "Yeni Şirket Oluştur" button + modal

### Task 3c: Tenant Detail Page (/superadmin/tenants/:id)
File: `frontend/src/pages/SuperAdmin/TenantDetail.tsx`
- Left card: tenant info (name, email, phone, address, taxOffice, taxNumber, createdAt, user count)
- Right table: users with columns: Ad, E-posta, Rol (badge), Kayıt Tarihi, İşlemler
- Actions per user row: "Şifre Değiştir" (modal), "E-posta Değiştir" (modal), "Sil" (confirm then delete)
- "Kullanıcı Ekle" button that opens add user modal
- Modals: ChangePasswordModal, ChangeEmailModal, AddUserModal

### Task 3d: Users List Page (/superadmin/users)
File: `frontend/src/pages/SuperAdmin/Users.tsx`
- Full users table: Ad, E-posta, Firma, Rol, Kayıt Tarihi, İşlemler
- Actions: Şifre Değiştir, E-posta Değiştir, Sil

### Task 3e: Invites Page (/superadmin/invites)
File: `frontend/src/pages/SuperAdmin/Invites.tsx`
- Full invites table: Kod, Durum (Aktif/Kullanıldı badge), Kullanan E-posta, Tarih, Sil
- "Yeni Davet Kodu Üret" button + modal

## Task 4: Frontend - App.tsx Routes Update
Update `frontend/src/App.tsx` to add new routes:
- /superadmin → SuperAdmin (existing, now dashboard only)
- /superadmin/tenants → Tenants page
- /superadmin/tenants/:id → TenantDetail page  
- /superadmin/users → Users page
- /superadmin/invites → Invites page

Import all new pages. All routes stay inside the ProtectedRoute + MainLayout structure.

## Task 5: Frontend - Shared SuperAdmin API client
Create `frontend/src/api/superadmin.ts` with typed API functions:
- getStats(), getTenants(), getTenant(id), createTenant(data), 
- getUsers(), updateUserPassword(id, password), updateUserEmail(id, email), deleteUser(id)
- addUserToTenant(tenantId, data)
- getInvites(), createInvite(code), deleteInvite(id)
