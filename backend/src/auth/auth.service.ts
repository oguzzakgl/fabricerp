/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';

interface ExtendedInviteCode {
  id: string;
  code: string;
  plan: string;
  isUsed: boolean;
  usedAt: Date | null;
  createdAt: Date;
}

interface ExtendedUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  tenantId: string | null;
  plan: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ExtendedTenant {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxOffice: string | null;
  taxNumber: string | null;
  iban: string | null;
  logoUrl: string | null;
  plan: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const inviteRecord = (await this.prisma.inviteCode.findUnique({
      where: { code: dto.inviteCode.trim().toUpperCase() },
    })) as unknown as ExtendedInviteCode;

    if (!inviteRecord) {
      throw new BadRequestException('Geçersiz davetiye kodu.');
    }

    if (inviteRecord.isUsed) {
      throw new BadRequestException('Bu davetiye kodu daha önce kullanılmış.');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('Bu e-posta adresi zaten kullanımda.');
    }

    const existingTenant = await this.prisma.tenant.findFirst({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingTenant) {
      throw new ConflictException(
        'Bu e-posta adresine kayıtlı bir firma zaten mevcut.',
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Create User and mark code as used inside transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Mark code as used
      await tx.inviteCode.update({
        where: { id: inviteRecord.id },
        data: {
          isUsed: true,
          usedAt: new Date(),
        },
      });

      const user = (await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          password: passwordHash,
          tenantId: null, // Tenant onboarding adımında kurulacak
          role: 'ADMIN',
          plan: inviteRecord.plan, // Davet kodundaki planı kullanıcıya ata
        } as unknown as any,
      })) as unknown as ExtendedUser;

      return { user };
    });

    const payload = {
      sub: result.user.id,
      email: result.user.email,
      tenantId: null,
      role: result.user.role,
    };

    const token = this.jwtService.sign(payload);

    // Kayıt bildirim maili gönder (Asenkron)
    const adminNotificationEmail =
      process.env.ADMIN_NOTIFICATION_EMAIL || 'info@fabricerp.com';
    const subject = 'Yeni Kullanıcı Kaydı Bildirimi - FabricERP';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #3b82f6; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">Yeni Kullanıcı Kaydoldu</h2>
        <p>Sisteminize yeni bir kullanıcı üye olmuştur. Detaylar aşağıdadır:</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <tr>
            <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #f0f0f0; width: 150px;">E-posta Adresi:</td>
            <td style="padding: 8px; border-bottom: 1px solid #f0f0f0;"><a href="mailto:${dto.email}">${dto.email}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #f0f0f0;">Kullanılan Davet Kodu:</td>
            <td style="padding: 8px; border-bottom: 1px solid #f0f0f0;">${dto.inviteCode}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #f0f0f0;">Kayıt Tarihi:</td>
            <td style="padding: 8px; border-bottom: 1px solid #f0f0f0;">${new Date().toLocaleString('tr-TR')}</td>
          </tr>
        </table>
        <p style="margin-top: 20px; font-size: 12px; color: #888;">Bu e-posta FabricERP sistemi tarafından otomatik olarak gönderilmiştir.</p>
      </div>
    `;
    this.mailService
      .sendMail(adminNotificationEmail, subject, html)
      .catch((err) => {
        console.error('Kayıt bildirim maili gönderilemedi:', err);
      });

    return {
      token,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
      },
      tenant: null,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { tenant: true },
    });

    if (!user) {
      throw new UnauthorizedException('E-posta adresi veya şifre hatalı.');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('E-posta adresi veya şifre hatalı.');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
    };

    const token = this.jwtService.sign(payload);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
      },
      tenant: user.tenant
        ? {
            id: user.tenant.id,
            name: user.tenant.name,
            plan: (user.tenant as unknown as ExtendedTenant).plan,
          }
        : null,
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });

    if (!user) {
      throw new UnauthorizedException('Kullanıcı bulunamadı.');
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
      },
      tenant: user.tenant
        ? {
            id: user.tenant.id,
            name: user.tenant.name,
            email: user.tenant.email,
            phone: user.tenant.phone,
            address: user.tenant.address,
            taxOffice: user.tenant.taxOffice,
            taxNumber: user.tenant.taxNumber,
            iban: user.tenant.iban,
            logoUrl: user.tenant.logoUrl,
            plan: (user.tenant as unknown as ExtendedTenant).plan,
          }
        : null,
    };
  }

  async completeOnboarding(
    userId: string,
    dto: { name: string; tenantName: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('Kullanıcı bulunamadı.');
    }

    if (user.tenantId) {
      throw new BadRequestException(
        'Bu kullanıcı için zaten bir firma kurulu.',
      );
    }

    const existingTenant = await this.prisma.tenant.findFirst({
      where: { email: user.email.toLowerCase() },
    });

    if (existingTenant) {
      throw new BadRequestException(
        'Bu e-posta adresine kayıtlı bir firma zaten mevcut.',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = (await tx.tenant.create({
        data: {
          name: dto.tenantName,
          email: user.email,
          plan: (user as unknown as ExtendedUser).plan,
        } as unknown as any,
      })) as unknown as ExtendedTenant;

      // 2. Kullanıcıyı bu tenant'a bağla ve ismini güncelle
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          name: dto.name,
          tenantId: tenant.id,
        },
      });

      return { tenant, user: updatedUser };
    });

    // Güncel token üret
    const payload = {
      sub: result.user.id,
      email: result.user.email,
      tenantId: result.tenant.id,
      role: result.user.role,
    };

    const token = this.jwtService.sign(payload);

    // Firma kurulum/onboarding bildirim maili gönder (Asenkron)
    const adminNotificationEmail =
      process.env.ADMIN_NOTIFICATION_EMAIL || 'info@fabricerp.com';
    const completeSubject = 'Yeni Firma Kurulumu Bildirimi - FabricERP';
    const completeHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #10b981; border-bottom: 2px solid #10b981; padding-bottom: 10px;">Yeni Firma Kuruldu</h2>
        <p>Yeni kaydolan bir kullanıcı onboarding adımını tamamlayarak firmasını kurmuştur. Detaylar:</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <tr>
            <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #f0f0f0; width: 150px;">Firma/Tenant Adı:</td>
            <td style="padding: 8px; border-bottom: 1px solid #f0f0f0;">${dto.tenantName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #f0f0f0;">Yönetici Adı Soyadı:</td>
            <td style="padding: 8px; border-bottom: 1px solid #f0f0f0;">${dto.name}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #f0f0f0;">Yönetici E-posta:</td>
            <td style="padding: 8px; border-bottom: 1px solid #f0f0f0;"><a href="mailto:${user.email}">${user.email}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #f0f0f0;">Kurulum Tarihi:</td>
            <td style="padding: 8px; border-bottom: 1px solid #f0f0f0;">${new Date().toLocaleString('tr-TR')}</td>
          </tr>
        </table>
        <p style="margin-top: 20px; font-size: 12px; color: #888;">Bu e-posta FabricERP sistemi tarafından otomatik olarak gönderilmiştir.</p>
      </div>
    `;
    this.mailService
      .sendMail(adminNotificationEmail, completeSubject, completeHtml)
      .catch((err) => {
        console.error('Firma kurulum bildirim maili gönderilemedi:', err);
      });

    return {
      token,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
      },
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
      },
    };
  }

  async requestInvite(email: string) {
    if (!email || !email.includes('@')) {
      throw new BadRequestException('Geçerli bir e-posta adresi giriniz.');
    }

    const adminNotificationEmail =
      process.env.ADMIN_NOTIFICATION_EMAIL || 'kaanakgl1907@gmail.com';
    const subject = 'Davet Kodu Talebi - FabricERP';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #f59e0b; border-bottom: 2px solid #f59e0b; padding-bottom: 10px;">Yeni Davet Kodu Talebi</h2>
        <p>Aşağıdaki e-posta adresine sahip kullanıcı sisteme kayıt olabilmek için davet kodu talep ediyor:</p>
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; border: 1px solid #f3f4f6; margin: 15px 0;">
          <strong>E-posta Adresi:</strong> <a href="mailto:${email}">${email}</a>
        </div>
        <p>Müşteriye davet kodu göndermek için:</p>
        <ol>
          <li>SuperAdmin panelinize giriş yapın.</li>
          <li><strong>Davet Kodları</strong> sekmesinden yeni bir kod oluşturun.</li>
          <li>Oluşturduğunuz kodu bu e-posta adresine yanıt vererek veya doğrudan ileterek gönderin.</li>
        </ol>
        <p style="margin-top: 20px; font-size: 12px; color: #888;">Bu e-posta FabricERP sistemi tarafından otomatik olarak gönderilmiştir.</p>
      </div>
    `;

    await this.mailService.sendMail(adminNotificationEmail, subject, html);
    return {
      success: true,
      message: 'Davet kodu talebiniz yöneticiye iletilmiştir.',
    };
  }
}
