/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
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

  convertCurrency(amount: number, from: string, to: string): number {
    if (from === to) return amount;
    const ratesInTry: { [key: string]: number } = {
      TRY: 1.0,
      USD: 34.0,
      EUR: 37.0,
    };
    const amountInTry = amount * (ratesInTry[from] || 1.0);
    return amountInTry / (ratesInTry[to] || 1.0);
  }

  calculateAccountBalances(account: any) {
    const currency = account.currency || 'TRY';

    let totalOrderBorc = 0;
    if (account.type === 'CUSTOMER' || account.type === 'BOTH') {
      totalOrderBorc = (account.orders || []).reduce(
        (sum: number, order: any) => {
          if (order.status !== 'cancelled' && order.status !== 'draft') {
            return sum + Number(order.totalAmount || 0);
          }
          return sum;
        },
        0,
      );
    }

    let totalYarnStockPayable = 0;
    if (account.type === 'SUPPLIER' || account.type === 'BOTH') {
      totalYarnStockPayable = (account.yarnStocks || []).reduce(
        (sum: number, yarn: any) => {
          return (
            sum + Number(yarn.initialKg || 0) * Number(yarn.unitPrice || 0)
          );
        },
        0,
      );
    }

    let totalReceived = 0;
    let totalPaid = 0;

    (account.financialTransactions || []).forEach((tx: any) => {
      if (tx.status === 'cancelled' || tx.status === 'bounced') return;

      let txAmount = Number(tx.amount || 0);
      if (tx.currency !== currency) {
        if (tx.convertedAmount && tx.targetCurrency === currency) {
          txAmount = Number(tx.convertedAmount);
        } else {
          txAmount = this.convertCurrency(txAmount, tx.currency, currency);
        }
      }

      if (tx.direction === 'RECEIVABLE') {
        totalReceived += txAmount;
      } else if (tx.direction === 'PAYABLE') {
        totalPaid += txAmount;
      }
    });

    let netBalance = 0;
    if (account.type === 'CUSTOMER') {
      netBalance = totalOrderBorc - totalReceived;
    } else if (account.type === 'SUPPLIER') {
      netBalance = -(totalYarnStockPayable - totalPaid);
    } else {
      netBalance =
        totalOrderBorc - totalReceived - (totalYarnStockPayable - totalPaid);
    }

    const balanceInDefault = netBalance;
    const balanceTRY = this.convertCurrency(balanceInDefault, currency, 'TRY');
    const balanceUSD = this.convertCurrency(balanceInDefault, currency, 'USD');
    const balanceEUR = this.convertCurrency(balanceInDefault, currency, 'EUR');

    return {
      balanceTRY,
      balanceUSD,
      balanceEUR,
      balanceInDefault,
      defaultCurrency: currency,
    };
  }

  async createPayment(accountId: string, paymentDto: any, tenantId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, tenantId },
    });
    if (!account) {
      throw new NotFoundException(`Cari hesap bulunamadı.`);
    }

    return this.prisma.financialTransaction.create({
      data: {
        accountId,
        type: paymentDto.type || 'CASH',
        direction: account.type === 'SUPPLIER' ? 'PAYABLE' : 'RECEIVABLE',
        amount: paymentDto.amount,
        currency: paymentDto.currency || 'TRY',
        convertedAmount: paymentDto.convertedAmount || null,
        exchangeRate: paymentDto.exchangeRate || null,
        targetCurrency: paymentDto.targetCurrency || null,
        status: 'collected',
        bankName: paymentDto.bankName || null,
        referenceNumber: paymentDto.referenceNumber || null,
        notes: paymentDto.notes || null,
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
        include: {
          orders: { where: { tenantId } },
          yarnStocks: { where: { tenantId } },
          financialTransactions: { where: { tenantId } },
        },
      }),
      this.prisma.account.count({ where }),
    ]);

    const mappedData = data.map((account) => {
      const balances = this.calculateAccountBalances(account);
      const { orders, yarnStocks, financialTransactions, ...rest } =
        account as any;
      return {
        ...rest,
        ...balances,
      };
    });

    return {
      data: mappedData,
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
            orderItems: {
              include: {
                roll: true,
              },
            },
          },
        },
        financialTransactions: {
          where: { tenantId },
          orderBy: { createdAt: 'desc' },
        },
        waybills: {
          where: { tenantId },
          orderBy: { createdAt: 'desc' },
          include: {
            waybillItems: true,
          },
        },
      } as any,
    });
    if (!account) {
      throw new NotFoundException(`ID'si '${id}' olan Cari hesap bulunamadı.`);
    }

    const balances = this.calculateAccountBalances(account);
    return {
      ...account,
      ...balances,
    };
  }

  async update(
    id: string,
    updateAccountDto: UpdateAccountDto,
    tenantId: string,
  ) {
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
        throw new ConflictException(
          `Cari kodu '${updateAccountDto.code}' zaten kullanımda.`,
        );
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
            throw new ConflictException(
              `Cari kodu '${code}' zaten kullanımda.`,
            );
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
