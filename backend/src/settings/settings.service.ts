import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
    };
  }

  async updateSettings(tenantId: string, data: any) {
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
    };
  }

  getTaxRate(tenantId?: string): number {
    return 20; // Türkiye KDV oranı varsayılan 20%
  }
}
