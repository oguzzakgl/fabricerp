import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  async generateNextCode(type: string, tenantId: string): Promise<string> {
    let prefix = 'C-';
    if (type === 'CUSTOMER') prefix = 'M-';
    if (type === 'SUPPLIER') prefix = 'S-';

    const latestAccount = await this.prisma.account.findFirst({
      where: {
        tenantId,
        code: {
          startsWith: prefix,
        },
      },
      orderBy: {
        code: 'desc',
      },
    });

    if (!latestAccount) {
      return `${prefix}00001`;
    }

    const currentCode = latestAccount.code;
    const numericPart = currentCode.substring(prefix.length);
    const num = parseInt(numericPart, 10);
    if (isNaN(num)) {
      return `${prefix}00001`;
    }

    const nextNum = num + 1;
    const paddedNum = String(nextNum).padStart(5, '0');
    return `${prefix}${paddedNum}`;
  }

  async create(createAccountDto: CreateAccountDto, tenantId: string) {
    let code = createAccountDto.code;
    if (!code) {
      code = await this.generateNextCode(createAccountDto.type, tenantId);
    } else {
      const existing = await this.prisma.account.findUnique({
        where: {
          code_tenantId: {
            code,
            tenantId,
          },
        },
      });
      if (existing) {
        throw new ConflictException(`Cari kodu '${code}' zaten kullanımda.`);
      }
    }
    return this.prisma.account.create({
      data: {
        ...createAccountDto,
        code,
        tenantId,
      },
    });
  }

  async findAll(
    params: {
      page?: number;
      limit?: number;
      search?: string;
      type?: string;
    },
    tenantId: string,
  ) {
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (params.type) {
      where.type = params.type;
    }

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { code: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.account.findMany({
        where,
        skip,
        take: limit,
        orderBy: { code: 'asc' },
      }),
      this.prisma.account.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string, tenantId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id, tenantId },
      include: {
        yarnStocks: {
          where: { tenantId },
          orderBy: { createdAt: 'desc' },
        },
        orders: {
          where: { tenantId },
          orderBy: { createdAt: 'desc' },
          include: {
            orderItems: true,
          },
        },
        financialTransactions: {
          where: { tenantId },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!account) {
      throw new NotFoundException(`ID'si '${id}' olan Cari hesap bulunamadı.`);
    }
    return account;
  }

  async update(id: string, updateAccountDto: UpdateAccountDto, tenantId: string) {
    await this.findOne(id, tenantId);

    if (updateAccountDto.code) {
      const existing = await this.prisma.account.findFirst({
        where: {
          tenantId,
          code: updateAccountDto.code,
          id: { not: id },
        },
      });
      if (existing) {
        throw new ConflictException(`Cari kodu '${updateAccountDto.code}' zaten kullanımda.`);
      }
    }

    return this.prisma.account.update({
      where: { id },
      data: updateAccountDto,
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.account.delete({
      where: { id },
    });
  }

  async createBulk(dtos: CreateAccountDto[], tenantId: string) {
    // Get latest code numbers for CUSTOMER (M-) and SUPPLIER (S-)
    const latestCustomer = await this.prisma.account.findFirst({
      where: { tenantId, code: { startsWith: 'M-' } },
      orderBy: { code: 'desc' },
    });
    const latestSupplier = await this.prisma.account.findFirst({
      where: { tenantId, code: { startsWith: 'S-' } },
      orderBy: { code: 'desc' },
    });

    let nextCustomerNum = 1;
    if (latestCustomer) {
      const num = parseInt(latestCustomer.code.substring(2), 10);
      if (!isNaN(num)) nextCustomerNum = num + 1;
    }

    let nextSupplierNum = 1;
    if (latestSupplier) {
      const num = parseInt(latestSupplier.code.substring(2), 10);
      if (!isNaN(num)) nextSupplierNum = num + 1;
    }

    return this.prisma.$transaction(async (tx) => {
      const createdAccounts = [];

      for (const dto of dtos) {
        let code = dto.code;

        if (!code) {
          const isCustomer = dto.type === 'CUSTOMER' || dto.type === 'BOTH';
          const prefix = isCustomer ? 'M-' : 'S-';
          const nextNum = isCustomer ? nextCustomerNum++ : nextSupplierNum++;
          code = `${prefix}${String(nextNum).padStart(5, '0')}`;
        } else {
          const existing = await tx.account.findUnique({
            where: {
              code_tenantId: {
                code,
                tenantId,
              },
            },
          });
          if (existing) {
            throw new ConflictException(`Cari kodu '${code}' zaten kullanımda.`);
          }
        }

        const account = await tx.account.create({
          data: {
            ...dto,
            code,
            tenantId,
          },
        });
        createdAccounts.push(account);
      }

      return createdAccounts;
    });
  }

  async getStats(tenantId: string) {
    const customers = await this.prisma.account.count({
      where: { tenantId, type: 'CUSTOMER' },
    });
    const suppliers = await this.prisma.account.count({
      where: { tenantId, type: 'SUPPLIER' },
    });
    const both = await this.prisma.account.count({
      where: { tenantId, type: 'BOTH' },
    });

    return {
      customers,
      suppliers,
      both,
    };
  }
}
