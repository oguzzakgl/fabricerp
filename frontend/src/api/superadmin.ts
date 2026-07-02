import apiClient from './client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TenantUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxOffice: string | null;
  taxNumber: string | null;
  iban: string | null;
  logoUrl: string | null;
  geminiApiKey: string | null;
  geminiPrompt: string | null;
  geminiYarnPrompt: string | null;
  plan: string;
  createdAt: string;
  users: TenantUser[];
}

export interface SuperAdminUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
  plan: string;
  tenant: { name: string; plan: string } | null;
}

export interface InviteCode {
  id: string;
  code: string;
  plan: string;
  isUsed: boolean;
  usedAt: string | null;
  createdAt: string;
}

export interface SuperAdminStats {
  tenants: number;
  users: number;
  invites: number;
}

// ─── API Functions ────────────────────────────────────────────────────────────

export const superAdminApi = {
  // Stats
  getStats: (): Promise<{ data: SuperAdminStats }> =>
    apiClient.get('/settings/super/stats'),

  // Tenants
  getTenants: (): Promise<{ data: Tenant[] }> =>
    apiClient.get('/settings/super/tenants'),

  getTenant: (id: string): Promise<{ data: Tenant }> =>
    apiClient.get(`/settings/super/tenants/${id}`),

  createTenant: (data: { tenantName: string; adminEmail: string; adminPassword: string }): Promise<{ data: Tenant }> =>
    apiClient.post('/settings/super/tenants', data),

  // Users (global)
  getUsers: (): Promise<{ data: SuperAdminUser[] }> =>
    apiClient.get('/settings/super/users'),

  updateUserPassword: (id: string, newPassword: string): Promise<{ data: { success: boolean } }> =>
    apiClient.patch(`/settings/super/users/${id}/password`, { newPassword }),

  updateUserEmail: (id: string, newEmail: string): Promise<{ data: { success: boolean } }> =>
    apiClient.patch(`/settings/super/users/${id}/email`, { newEmail }),

  deleteUser: (id: string): Promise<{ data: { success: boolean } }> =>
    apiClient.delete(`/settings/super/users/${id}`),

  // Users per tenant
  addUserToTenant: (tenantId: string, data: { name: string; email: string; password: string; role: string }): Promise<{ data: TenantUser }> =>
    apiClient.post(`/settings/super/tenants/${tenantId}/users`, data),

  // Tenant settings (geminiApiKey etc.)
  updateTenantSettings: (tenantId: string, data: { geminiApiKey: string; geminiPrompt?: string; geminiYarnPrompt?: string }): Promise<{ data: { success: boolean } }> =>
    apiClient.patch(`/settings/super/tenants/${tenantId}/settings`, data),

  // Invites
  getInvites: (): Promise<{ data: InviteCode[] }> =>
    apiClient.get('/settings/super/invites'),

  createInvite: (code: string, plan: string): Promise<{ data: InviteCode }> =>
    apiClient.post('/settings/super/invites', { code, plan }),

  deleteInvite: (id: string): Promise<{ data: unknown }> =>
    apiClient.delete(`/settings/super/invites/${id}`),
};
