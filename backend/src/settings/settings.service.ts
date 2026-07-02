/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

import { IsString, IsOptional, IsEmail } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  taxOffice?: string;

  @IsOptional()
  @IsString()
  taxNumber?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  iban?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  geminiApiKey?: string;

  @IsOptional()
  @IsString()
  geminiPrompt?: string;

  @IsOptional()
  @IsString()
  geminiYarnPrompt?: string;
}

export class CreateUserDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  password!: string;

  @IsString()
  role!: string;
}

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getSettings(tenantId: string) {
    if (!tenantId) {
      return {
        taxRate: 20,
        companyName: 'Super Admin',
        taxOffice: '',
        taxNumber: '',
        phone: '',
        email: 'admin@fabricore.com',
        address: '',
        iban: '',
        logoUrl: '',
        geminiApiKey: '',
      };
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Fabrika ayarları bulunamadı.');
    }

    return {
      taxRate: 20,
      companyName: tenant.name,
      taxOffice: tenant.taxOffice || '',
      taxNumber: tenant.taxNumber || '',
      phone: tenant.phone || '',
      email: tenant.email || '',
      address: tenant.address || '',
      iban: tenant.iban || '',
      logoUrl: tenant.logoUrl || '',
      geminiApiKey:
        (tenant as { geminiApiKey?: string | null }).geminiApiKey || '',
      geminiPrompt:
        (tenant as { geminiPrompt?: string | null }).geminiPrompt || '',
      geminiYarnPrompt:
        (tenant as { geminiYarnPrompt?: string | null }).geminiYarnPrompt || '',
    };
  }

  async updateSettings(tenantId: string, data: UpdateSettingsDto) {
    if (!tenantId) {
      throw new BadRequestException(
        'Süper yönetici firma ayarlarını güncelleyemez.',
      );
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Fabrika bulunamadı.');
    }

    if (data.email) {
      const existingTenant = await this.prisma.tenant.findFirst({
        where: {
          email: data.email.toLowerCase(),
          id: { not: tenantId },
        },
      });
      if (existingTenant) {
        throw new BadRequestException(
          'Bu e-posta adresine kayıtlı başka bir firma zaten mevcut.',
        );
      }
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: data.companyName,
        taxOffice: data.taxOffice,
        taxNumber: data.taxNumber,
        phone: data.phone,
        email: data.email,
        address: data.address,
        iban: data.iban,
        logoUrl: data.logoUrl,
        geminiApiKey: data.geminiApiKey,
        geminiPrompt: data.geminiPrompt,
        geminiYarnPrompt: data.geminiYarnPrompt,
      },
    });

    return {
      taxRate: 20,
      companyName: updated.name,
      taxOffice: updated.taxOffice || '',
      taxNumber: updated.taxNumber || '',
      phone: updated.phone || '',
      email: updated.email || '',
      address: updated.address || '',
      iban: updated.iban || '',
      logoUrl: updated.logoUrl || '',
      geminiApiKey:
        (updated as { geminiApiKey?: string | null }).geminiApiKey || '',
      geminiPrompt:
        (updated as { geminiPrompt?: string | null }).geminiPrompt || '',
      geminiYarnPrompt:
        (updated as { geminiYarnPrompt?: string | null }).geminiYarnPrompt ||
        '',
    };
  }

  getTaxRate(tenantId?: string): number {
    if (tenantId) {
      // tenantId can be used for custom tax rates later
    }
    return 20; // Türkiye KDV oranı varsayılan 20%
  }

  async getUsers(tenantId: string) {
    if (!tenantId) {
      return [];
    }
    return this.prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createUser(tenantId: string, data: CreateUserDto) {
    if (!tenantId) {
      throw new BadRequestException('Firma seçilmeden kullanıcı eklenemez.');
    }
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });
    if (existing) {
      throw new BadRequestException('Bu e-posta adresi zaten kullanımda.');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    return this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        password: passwordHash,
        role: data.role,
        tenantId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });
  }

  async deleteUser(tenantId: string, userId: string, activeUserId: string) {
    if (!tenantId) {
      throw new BadRequestException('Geçersiz işlem.');
    }
    if (userId === activeUserId) {
      throw new BadRequestException('Kendi kullanıcınızı silemezsiniz.');
    }
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı.');
    }
    return this.prisma.user.delete({ where: { id: userId } });
  }

  async superGetStats(activeUserId: string) {
    const activeUser = await this.prisma.user.findUnique({
      where: { id: activeUserId },
    });
    if (
      !activeUser ||
      activeUser.role !== 'SUPERADMIN' ||
      activeUser.tenantId !== null
    ) {
      throw new BadRequestException('Bu işlem için yetkiniz bulunmamaktadır.');
    }

    const [tenants, users, invites] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.user.count(),
      this.prisma.inviteCode.count(),
    ]);

    return { tenants, users, invites };
  }

  async superGetTenants(activeUserId: string) {
    const activeUser = await this.prisma.user.findUnique({
      where: { id: activeUserId },
    });
    if (
      !activeUser ||
      activeUser.role !== 'SUPERADMIN' ||
      activeUser.tenantId !== null
    ) {
      throw new BadRequestException('Bu işlem için yetkiniz bulunmamaktadır.');
    }

    return this.prisma.tenant.findMany({
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async superGetUsers(activeUserId: string) {
    const activeUser = await this.prisma.user.findUnique({
      where: { id: activeUserId },
    });
    if (
      !activeUser ||
      activeUser.role !== 'SUPERADMIN' ||
      activeUser.tenantId !== null
    ) {
      throw new BadRequestException('Bu işlem için yetkiniz bulunmamaktadır.');
    }

    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        tenant: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async superGetInvites(activeUserId: string) {
    const activeUser = await this.prisma.user.findUnique({
      where: { id: activeUserId },
    });
    if (
      !activeUser ||
      activeUser.role !== 'SUPERADMIN' ||
      activeUser.tenantId !== null
    ) {
      throw new BadRequestException('Bu işlem için yetkiniz bulunmamaktadır.');
    }

    return this.prisma.inviteCode.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async superCreateInvite(
    activeUserId: string,
    code: string,
    plan: string = 'STARTER',
  ) {
    const activeUser = await this.prisma.user.findUnique({
      where: { id: activeUserId },
    });
    if (
      !activeUser ||
      activeUser.role !== 'SUPERADMIN' ||
      activeUser.tenantId !== null
    ) {
      throw new BadRequestException('Bu işlem için yetkiniz bulunmamaktadır.');
    }

    const formattedCode = code.trim().toUpperCase();
    const existing = await this.prisma.inviteCode.findUnique({
      where: { code: formattedCode },
    });
    if (existing) {
      throw new BadRequestException('Bu davet kodu zaten mevcut.');
    }

    return this.prisma.inviteCode.create({
      data: {
        code: formattedCode,
        plan,
        isUsed: false,
      } as any,
    });
  }

  async superDeleteInvite(activeUserId: string, id: string) {
    const activeUser = await this.prisma.user.findUnique({
      where: { id: activeUserId },
    });
    if (
      !activeUser ||
      activeUser.role !== 'SUPERADMIN' ||
      activeUser.tenantId !== null
    ) {
      throw new BadRequestException('Bu işlem için yetkiniz bulunmamaktadır.');
    }

    return this.prisma.inviteCode.delete({ where: { id } });
  }

  async superCreateTenant(
    activeUserId: string,
    data: { tenantName: string; adminEmail: string; adminPassword: string },
  ) {
    const activeUser = await this.prisma.user.findUnique({
      where: { id: activeUserId },
    });
    if (
      !activeUser ||
      activeUser.role !== 'SUPERADMIN' ||
      activeUser.tenantId !== null
    ) {
      throw new BadRequestException('Bu işlem için yetkiniz bulunmamaktadır.');
    }
    const existing = await this.prisma.user.findUnique({
      where: { email: data.adminEmail.toLowerCase() },
    });
    if (existing) {
      throw new BadRequestException('Bu e-posta adresi zaten kullanımda.');
    }
    const existingTenant = await this.prisma.tenant.findFirst({
      where: { email: data.adminEmail.toLowerCase() },
    });
    if (existingTenant) {
      throw new BadRequestException(
        'Bu e-posta adresine kayıtlı bir firma zaten mevcut.',
      );
    }
    const passwordHash = await bcrypt.hash(data.adminPassword, 10);
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: data.tenantName, email: data.adminEmail.toLowerCase() },
      });
      const user = await tx.user.create({
        data: {
          email: data.adminEmail.toLowerCase(),
          password: passwordHash,
          role: 'ADMIN',
          tenantId: tenant.id,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });
      return { ...tenant, users: [user] };
    });
  }

  async superGetTenant(activeUserId: string, tenantId: string) {
    const activeUser = await this.prisma.user.findUnique({
      where: { id: activeUserId },
    });
    if (
      !activeUser ||
      activeUser.role !== 'SUPERADMIN' ||
      activeUser.tenantId !== null
    ) {
      throw new BadRequestException('Bu işlem için yetkiniz bulunmamaktadır.');
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!tenant) throw new NotFoundException('Firma bulunamadı.');
    return tenant;
  }

  async superUpdateUserPassword(
    activeUserId: string,
    userId: string,
    newPassword: string,
  ) {
    const activeUser = await this.prisma.user.findUnique({
      where: { id: activeUserId },
    });
    if (
      !activeUser ||
      activeUser.role !== 'SUPERADMIN' ||
      activeUser.tenantId !== null
    ) {
      throw new BadRequestException('Bu işlem için yetkiniz bulunmamaktadır.');
    }
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('Şifre en az 6 karakter olmalıdır.');
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: passwordHash },
    });
    return { success: true };
  }

  async superUpdateUserEmail(
    activeUserId: string,
    userId: string,
    newEmail: string,
  ) {
    const activeUser = await this.prisma.user.findUnique({
      where: { id: activeUserId },
    });
    if (
      !activeUser ||
      activeUser.role !== 'SUPERADMIN' ||
      activeUser.tenantId !== null
    ) {
      throw new BadRequestException('Bu işlem için yetkiniz bulunmamaktadır.');
    }
    if (!newEmail || !newEmail.includes('@')) {
      throw new BadRequestException('Geçerli bir e-posta adresi giriniz.');
    }
    const existing = await this.prisma.user.findUnique({
      where: { email: newEmail.toLowerCase() },
    });
    if (existing && existing.id !== userId) {
      throw new BadRequestException('Bu e-posta adresi zaten kullanımda.');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { email: newEmail.toLowerCase() },
    });
    return { success: true };
  }

  async superAddUserToTenant(
    activeUserId: string,
    tenantId: string,
    data: CreateUserDto,
  ) {
    const activeUser = await this.prisma.user.findUnique({
      where: { id: activeUserId },
    });
    if (
      !activeUser ||
      activeUser.role !== 'SUPERADMIN' ||
      activeUser.tenantId !== null
    ) {
      throw new BadRequestException('Bu işlem için yetkiniz bulunmamaktadır.');
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Firma bulunamadı.');
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });
    if (existing)
      throw new BadRequestException('Bu e-posta adresi zaten kullanımda.');
    const passwordHash = await bcrypt.hash(data.password, 10);
    return this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        password: passwordHash,
        role: data.role,
        tenantId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
  }

  async superDeleteUser(activeUserId: string, userId: string) {
    const activeUser = await this.prisma.user.findUnique({
      where: { id: activeUserId },
    });
    if (
      !activeUser ||
      activeUser.role !== 'SUPERADMIN' ||
      activeUser.tenantId !== null
    ) {
      throw new BadRequestException('Bu işlem için yetkiniz bulunmamaktadır.');
    }
    if (userId === activeUserId) {
      throw new BadRequestException('Kendi hesabınızı silemezsiniz.');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı.');
    await this.prisma.user.delete({ where: { id: userId } });
    return { success: true };
  }

  async superUpdateTenantSettings(
    activeUserId: string,
    tenantId: string,
    data: {
      geminiApiKey: string;
      geminiPrompt?: string;
      geminiYarnPrompt?: string;
    },
  ) {
    const activeUser = await this.prisma.user.findUnique({
      where: { id: activeUserId },
    });
    if (
      !activeUser ||
      activeUser.role !== 'SUPERADMIN' ||
      activeUser.tenantId !== null
    ) {
      throw new BadRequestException('Bu işlem için yetkiniz bulunmamaktadır.');
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Firma bulunamadı.');
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        geminiApiKey: data.geminiApiKey,
        geminiPrompt: data.geminiPrompt,
        geminiYarnPrompt: data.geminiYarnPrompt,
      },
    });
    return { success: true };
  }
}
