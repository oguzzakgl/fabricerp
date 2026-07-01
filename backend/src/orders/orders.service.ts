import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { SettingsService } from '../settings/settings.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private settingsService: SettingsService,
  ) {}

  private async generateOrderNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const lastOrder = await this.prisma.order.findFirst({
      where: {
        tenantId,
        orderNumber: { startsWith: `SIP-${year}-` },
      },
      orderBy: { createdAt: 'desc' },
      select: { orderNumber: true },
    });

    if (!lastOrder) {
      return `SIP-${year}-00001`;
    }

    const parts = lastOrder.orderNumber.split('-');
    const lastNumStr = parts[parts.length - 1];
    const lastNum = parseInt(lastNumStr, 10);

    if (isNaN(lastNum)) {
      const count = await this.prisma.order.count({ where: { tenantId } });
      return `SIP-${year}-${String(count + 1).padStart(5, '0')}`;
    }

    return `SIP-${year}-${String(lastNum + 1).padStart(5, '0')}`;
  }

  async create(createOrderDto: CreateOrderDto, tenantId: string) {
    const { customerId, notes, items } = createOrderDto;

    // Validate customer under this tenant
    const customer = await this.prisma.account.findFirst({
      where: { id: customerId, tenantId },
    });
    if (!customer)
      throw new NotFoundException(`Müşteri Cari hesabı bulunamadı.`);
    if (customer.type !== 'CUSTOMER' && customer.type !== 'BOTH') {
      throw new BadRequestException(
        `Seçilen Cari hesabın tipi CUSTOMER veya BOTH olmalıdır.`,
      );
    }

    if (!items || items.length === 0) {
      throw new BadRequestException(
        `Sipariş en az bir kumaş topu içermelidir.`,
      );
    }

    const orderNumber = await this.generateOrderNumber(tenantId);

    return this.prisma.$transaction(async (tx) => {
      let subtotal = 0;

      // Lock and validate all rolls
      for (const item of items) {
        const roll = await tx.roll.findFirst({
          where: { id: item.rollId, tenantId },
        });
        if (!roll)
          throw new NotFoundException(
            `Kumaş topu (ID: ${item.rollId}) bulunamadı.`,
          );
        if (roll.status !== 'available') {
          throw new BadRequestException(
            `Kumaş topu (barkod: ${roll.barcodeNumber}) müsait değil (durum: ${roll.status}).`,
          );
        }
        subtotal += Number(roll.lengthM) * Number(item.unitPrice);
      }

      // Calculate total amount including VAT (KDV) from settings
      const taxRate = this.settingsService.getTaxRate(tenantId);
      const totalAmount = subtotal * (1 + taxRate / 100);

      // Create order with items
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId,
          notes,
          totalAmount,
          currency: customer.currency || 'TRY',
          status: 'confirmed',
          tenantId,
          orderItems: {
            create: items.map((item) => ({
              rollId: item.rollId,
              unitPrice: item.unitPrice,
            })),
          },
        },
        include: {
          customer: true,
          orderItems: {
            include: { roll: true },
          },
        },
      });

      // Mark rolls as reserved
      await tx.roll.updateMany({
        where: { id: { in: items.map((i) => i.rollId) } },
        data: { status: 'reserved' },
      });

      return order;
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

    const where: Prisma.OrderWhereInput = { tenantId };
    if (params.status) where.status = params.status;
    if (params.customerId) where.customerId = params.customerId;

    if (params.search) {
      where.OR = [
        { orderNumber: { contains: params.search, mode: 'insensitive' } },
        {
          customer: { name: { contains: params.search, mode: 'insensitive' } },
        },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: true,
          orderItems: { include: { roll: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string, tenantId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        orderItems: { include: { roll: true } },
        invoices: true,
      },
    });
    if (!order)
      throw new NotFoundException(`ID'si '${id}' olan Sipariş bulunamadı.`);
    return order;
  }

  async update(id: string, updateOrderDto: UpdateOrderDto, tenantId: string) {
    await this.findOne(id, tenantId);
    const { notes, status } = updateOrderDto;
    return this.prisma.order.update({
      where: { id },
      data: { notes, status },
      include: {
        customer: true,
        orderItems: { include: { roll: true } },
      },
    });
  }

  async cancel(id: string, tenantId: string) {
    const order = await this.findOne(id, tenantId);
    if (order.status === 'invoiced') {
      throw new BadRequestException(
        'Faturası kesilmiş sipariş iptal edilemez.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Release reserved rolls back to available
      const rollIds = order.orderItems.map((item) => item.rollId);
      if (rollIds.length > 0) {
        await tx.roll.updateMany({
          where: { id: { in: rollIds }, status: 'reserved', tenantId },
          data: { status: 'available' },
        });
      }

      return tx.order.update({
        where: { id },
        data: { status: 'cancelled' },
        include: { customer: true, orderItems: { include: { roll: true } } },
      });
    });
  }

  async remove(id: string, tenantId: string) {
    const order = await this.findOne(id, tenantId);
    if (order.status === 'invoiced') {
      throw new BadRequestException('Faturası kesilmiş sipariş silinemez.');
    }
    return this.prisma.order.delete({ where: { id } });
  }

  async returnItems(id: string, rollIds: string[], tenantId: string) {
    const order = await this.findOne(id, tenantId);

    if (!rollIds || rollIds.length === 0) {
      throw new BadRequestException(
        'İade edilmek üzere en az bir kumaş topu seçilmelidir.',
      );
    }

    const orderItemsToReturn = order.orderItems.filter((item) =>
      rollIds.includes(item.rollId),
    );
    if (orderItemsToReturn.length !== rollIds.length) {
      throw new BadRequestException(
        'Seçilen kumaş toplarından bazıları bu siparişe ait değil.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Kumaş toplarının durumunu 'available' yapalım ve irsaliye ilişkisini koparalım
      await tx.roll.updateMany({
        where: { id: { in: rollIds }, tenantId },
        data: {
          status: 'available',
          waybillId: null,
        } as unknown as Prisma.RollUpdateManyMutationInput,
      });

      // 2. Sipariş kalemlerini silelim
      await tx.orderItem.deleteMany({
        where: {
          orderId: id,
          rollId: { in: rollIds },
        },
      });

      // 3. Siparişin toplam tutarını güncelleyelim
      const remainingOrderItems = order.orderItems.filter(
        (item) => !rollIds.includes(item.rollId),
      );

      let newTotal = 0;
      if (remainingOrderItems.length > 0) {
        const subtotal = remainingOrderItems.reduce(
          (sum, item) =>
            sum + Number(item.roll?.lengthM || 0) * Number(item.unitPrice),
          0,
        );
        const taxRate = this.settingsService.getTaxRate(tenantId);
        newTotal = subtotal * (1 + taxRate / 100);
      }

      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          totalAmount: newTotal,
          status: remainingOrderItems.length === 0 ? 'cancelled' : order.status,
        },
        include: {
          customer: true,
          orderItems: { include: { roll: true } },
        },
      });

      return updatedOrder;
    });
  }
}
