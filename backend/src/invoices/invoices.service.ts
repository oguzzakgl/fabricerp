import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  private async generateInvoiceNumber(tenantId: string): Promise<string> {
    const count = await this.prisma.invoice.count({ where: { tenantId } });
    const year = new Date().getFullYear();
    return `FAT-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  async create(createInvoiceDto: CreateInvoiceDto, tenantId: string) {
    const { orderId, customerId, issueDate, dueDate, taxRate, notes, items } = createInvoiceDto;

    // Validate customer under this tenant
    const customer = await this.prisma.account.findFirst({ where: { id: customerId, tenantId } });
    if (!customer) throw new NotFoundException(`Müşteri Cari hesabı bulunamadı.`);

    // Validate order if provided under this tenant
    if (orderId) {
      const order = await this.prisma.order.findFirst({ where: { id: orderId, tenantId } });
      if (!order) throw new NotFoundException(`Sipariş bulunamadı.`);
      if (order.status === 'invoiced') {
        throw new BadRequestException(`Bu sipariş zaten faturalandırılmış.`);
      }
    }

    if (!items || items.length === 0) {
      throw new BadRequestException(`Fatura en az bir kalem içermelidir.`);
    }

    const invoiceNumber = await this.generateInvoiceNumber(tenantId);

    // Calculate totals
    const subtotal = items.reduce(
      (sum, item) => sum + Number(item.quantity) * Number(item.unitPrice),
      0,
    );
    const taxAmount = (subtotal * Number(taxRate)) / 100;
    const totalAmount = subtotal + taxAmount;

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          orderId,
          customerId,
          issueDate: new Date(issueDate),
          dueDate: dueDate ? new Date(dueDate) : null,
          taxRate,
          subtotal,
          taxAmount,
          totalAmount,
          notes,
          status: 'sent',
          tenantId,
          invoiceItems: {
            create: items.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: Number(item.quantity) * Number(item.unitPrice),
            })),
          },
        },
        include: {
          customer: true,
          order: true,
          invoiceItems: true,
        },
      });

      // Mark order as invoiced if linked
      if (orderId) {
        await tx.order.update({
          where: { id: orderId },
          data: { status: 'invoiced' },
        });

        // Mark linked rolls as sold
        const orderItems = await tx.orderItem.findMany({ where: { orderId } });
        if (orderItems.length > 0) {
          await tx.roll.updateMany({
            where: { id: { in: orderItems.map((oi) => oi.rollId) } },
            data: { status: 'sold' },
          });
        }
      }

      return invoice;
    });
  }

  async findAll(
    params: {
      page?: number;
      limit?: number;
      search?: string;
      customerId?: string;
      status?: string;
    },
    tenantId: string,
  ) {
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (params.status) where.status = params.status;
    if (params.customerId) where.customerId = params.customerId;

    if (params.search) {
      where.OR = [
        { invoiceNumber: { contains: params.search, mode: 'insensitive' } },
        { customer: { name: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: true,
          order: true,
          invoiceItems: true,
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string, tenantId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        order: { include: { orderItems: { include: { roll: true } } } },
        invoiceItems: true,
        financialTransactions: true,
      },
    });
    if (!invoice) throw new NotFoundException(`ID'si '${id}' olan Fatura bulunamadı.`);
    return invoice;
  }

  async update(id: string, updateInvoiceDto: UpdateInvoiceDto, tenantId: string) {
    const invoice = await this.findOne(id, tenantId);
    if (invoice.status === 'paid') {
      throw new BadRequestException('Ödenmiş fatura güncellenemez.');
    }
    const { issueDate, dueDate, notes, status } = updateInvoiceDto;
    return this.prisma.invoice.update({
      where: { id },
      data: {
        issueDate: issueDate ? new Date(issueDate) : undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        notes,
        status,
      },
      include: { customer: true, invoiceItems: true },
    });
  }

  async remove(id: string, tenantId: string) {
    const invoice = await this.findOne(id, tenantId);
    if (invoice.status === 'paid') {
      throw new BadRequestException('Ödenmiş fatura silinemez.');
    }
    return this.prisma.invoice.delete({ where: { id } });
  }
}
