import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export class UpdateSettingsDto {
  companyName!: string;
  taxOffice?: string;
  taxNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
  iban?: string;
  logoUrl?: string;
  geminiApiKey?: string;
}

export class CreateUserDto {
  name!: string;
  email!: string;
  password!: string;
  role!: string;
}

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getSettings(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Fabrika ayarları bulunamadı.');
    }

    return {
      taxRate: 20, // Sabit veya sonradan genişletilebilir
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
    };
  }

  async updateSettings(tenantId: string, data: UpdateSettingsDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Fabrika bulunamadı.');
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
      } as unknown as Prisma.TenantUpdateInput,
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
    };
  }

  getTaxRate(tenantId?: string): number {
    if (tenantId) {
      // tenantId can be used for custom tax rates later
    }
    return 20; // Türkiye KDV oranı varsayılan 20%
  }

  async getUsers(tenantId: string) {
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
    if (!activeUser || activeUser.tenantId !== null) {
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
    if (!activeUser || activeUser.tenantId !== null) {
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
    if (!activeUser || activeUser.tenantId !== null) {
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
    if (!activeUser || activeUser.tenantId !== null) {
      throw new BadRequestException('Bu işlem için yetkiniz bulunmamaktadır.');
    }

    return this.prisma.inviteCode.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async superCreateInvite(activeUserId: string, code: string) {
    const activeUser = await this.prisma.user.findUnique({
      where: { id: activeUserId },
    });
    if (!activeUser || activeUser.tenantId !== null) {
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
        isUsed: false,
      },
    });
  }

  async superDeleteInvite(activeUserId: string, id: string) {
    const activeUser = await this.prisma.user.findUnique({
      where: { id: activeUserId },
    });
    if (!activeUser || activeUser.tenantId !== null) {
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
    if (!activeUser || activeUser.tenantId !== null) {
      throw new BadRequestException('Bu işlem için yetkiniz bulunmamaktadır.');
    }
    const existing = await this.prisma.user.findUnique({
      where: { email: data.adminEmail.toLowerCase() },
    });
    if (existing) {
      throw new BadRequestException('Bu e-posta adresi zaten kullanımda.');
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
    if (!activeUser || activeUser.tenantId !== null) {
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
    if (!activeUser || activeUser.tenantId !== null) {
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
    if (!activeUser || activeUser.tenantId !== null) {
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
    if (!activeUser || activeUser.tenantId !== null) {
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
    if (!activeUser || activeUser.tenantId !== null) {
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
}
