import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFinancialTransactionDto } from './dto/create-financial-transaction.dto';
import { UpdateFinancialTransactionDto } from './dto/update-financial-transaction.dto';

@Injectable()
export class FinanceService {
  constructor(private prisma: PrismaService) {}

  async create(createDto: CreateFinancialTransactionDto, tenantId: string) {
    // Validate account exists under this tenant
    const account = await this.prisma.account.findFirst({
      where: { id: createDto.accountId, tenantId },
    });
    if (!account) {
      throw new NotFoundException(`Cari hesap bulunamadı.`);
    }

    // Validate invoice if provided under this tenant
    if (createDto.invoiceId) {
      const invoice = await this.prisma.invoice.findFirst({
        where: { id: createDto.invoiceId, tenantId },
      });
      if (!invoice) {
        throw new NotFoundException(`Fatura bulunamadı.`);
      }
    }

    return this.prisma.financialTransaction.create({
      data: {
        accountId: createDto.accountId,
        invoiceId: createDto.invoiceId,
        type: createDto.type,
        direction: createDto.direction,
        amount: createDto.amount,
        currency: createDto.currency || 'TRY',
        dueDate: createDto.dueDate ? new Date(createDto.dueDate) : null,
        referenceNumber: createDto.referenceNumber,
        bankName: createDto.bankName,
        status: 'pending',
        notes: createDto.notes,
        tenantId,
      },
      include: {
        account: true,
        invoice: true,
      },
    });
  }

  async findAll(
    params: {
      page?: number;
      limit?: number;
      search?: string;
      accountId?: string;
      type?: string;
      status?: string;
    },
    tenantId: string,
  ) {
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (params.accountId) where.accountId = params.accountId;
    if (params.type) where.type = params.type;
    if (params.status) where.status = params.status;

    if (params.search) {
      where.OR = [
        { referenceNumber: { contains: params.search, mode: 'insensitive' } },
        { bankName: { contains: params.search, mode: 'insensitive' } },
        { account: { name: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.financialTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          account: true,
          invoice: true,
        },
      }),
      this.prisma.financialTransaction.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string, tenantId: string) {
    const transaction = await this.prisma.financialTransaction.findFirst({
      where: { id, tenantId },
      include: {
        account: true,
        invoice: true,
      },
    });
    if (!transaction) {
      throw new NotFoundException(`Finansal işlem bulunamadı.`);
    }
    return transaction;
  }

  async update(id: string, updateDto: UpdateFinancialTransactionDto, tenantId: string) {
    const transaction = await this.findOne(id, tenantId);

    const updateData: any = {
      ...updateDto,
    };

    if (updateDto.dueDate) {
      updateData.dueDate = new Date(updateDto.dueDate);
    }

    if (updateDto.collectedAt) {
      updateData.collectedAt = new Date(updateDto.collectedAt);
    }

    return this.prisma.financialTransaction.update({
      where: { id },
      data: updateData,
      include: {
        account: true,
        invoice: true,
      },
    });
  }

  async collect(id: string, tenantId: string) {
    const transaction = await this.findOne(id, tenantId);
    if (transaction.status === 'collected' || transaction.status === 'paid') {
      throw new BadRequestException('Bu işlem zaten tamamlanmış.');
    }

    const nextStatus = transaction.direction === 'RECEIVABLE' ? 'collected' : 'paid';

    return this.prisma.financialTransaction.update({
      where: { id },
      data: {
        status: nextStatus,
        collectedAt: new Date(),
      },
      include: {
        account: true,
        invoice: true,
      },
    });
  }

  async endorse(id: string, tenantId: string) {
    const transaction = await this.findOne(id, tenantId);
    if (transaction.status !== 'pending') {
      throw new BadRequestException('Yalnızca beklemedeki evraklar ciro edilebilir.');
    }

    return this.prisma.financialTransaction.update({
      where: { id },
      data: {
        status: 'endorsed',
      },
      include: {
        account: true,
        invoice: true,
      },
    });
  }

  async remove(id: string, tenantId: string) {
    const transaction = await this.findOne(id, tenantId);
    if (transaction.status === 'collected' || transaction.status === 'paid') {
      throw new BadRequestException('Tamamlanmış finansal işlemler silinemez.');
    }
    return this.prisma.financialTransaction.delete({
      where: { id },
    });
  }
}
