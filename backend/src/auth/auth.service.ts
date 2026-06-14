import { Injectable, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const inviteRecord = await this.prisma.inviteCode.findUnique({
      where: { code: dto.inviteCode.trim().toUpperCase() },
    });

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

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Create Tenant, User and mark code as used inside transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Mark code as used
      await tx.inviteCode.update({
        where: { id: inviteRecord.id },
        data: {
          isUsed: true,
          usedAt: new Date(),
        },
      });

      const tenant = await tx.tenant.create({
        data: {
          name: dto.tenantName,
          email: dto.email,
        },
      });

      const user = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          password: passwordHash,
          name: dto.name,
          tenantId: tenant.id,
          role: 'ADMIN',
        },
      });

      return { tenant, user };
    });

    const payload = {
      sub: result.user.id,
      email: result.user.email,
      tenantId: result.tenant.id,
      role: result.user.role,
    };

    const token = this.jwtService.sign(payload);

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
      },
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
      },
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
      },
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        email: user.tenant.email,
        phone: user.tenant.phone,
        address: user.tenant.address,
        taxOffice: user.tenant.taxOffice,
        taxNumber: user.tenant.taxNumber,
        iban: user.tenant.iban,
        logoUrl: user.tenant.logoUrl,
      },
    };
  }
}
