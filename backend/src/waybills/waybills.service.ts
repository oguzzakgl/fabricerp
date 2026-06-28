/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWaybillDto } from './dto/create-waybill.dto';

@Injectable()
export class WaybillsService {
  constructor(private prisma: PrismaService) {}

  private async generateWaybillNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const lastWaybill = await this.prisma.waybill.findFirst({
      where: {
        tenantId,
        waybillNumber: { startsWith: `IRS-${year}-` },
      },
      orderBy: { createdAt: 'desc' },
      select: { waybillNumber: true },
    });

    if (!lastWaybill) {
      return `IRS-${year}-00001`;
    }

    const parts = lastWaybill.waybillNumber.split('-');
    const lastNumStr = parts[parts.length - 1];
    const lastNum = parseInt(lastNumStr, 10);

    if (isNaN(lastNum)) {
      const count = await this.prisma.waybill.count({ where: { tenantId } });
      return `IRS-${year}-${String(count + 1).padStart(5, '0')}`;
    }

    return `IRS-${year}-${String(lastNum + 1).padStart(5, '0')}`;
  }

  private async generateInvoiceNumber(
    tenantId: string,
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const lastInvoice = await tx.invoice.findFirst({
      where: {
        tenantId,
        invoiceNumber: { startsWith: `FAT-${year}-` },
      },
      orderBy: { createdAt: 'desc' },
      select: { invoiceNumber: true },
    });

    if (!lastInvoice) {
      return `FAT-${year}-00001`;
    }

    const parts = lastInvoice.invoiceNumber.split('-');
    const lastNumStr = parts[parts.length - 1];
    const lastNum = parseInt(lastNumStr, 10);

    if (isNaN(lastNum)) {
      const count = await tx.invoice.count({ where: { tenantId } });
      return `FAT-${year}-${String(count + 1).padStart(5, '0')}`;
    }

    return `FAT-${year}-${String(lastNum + 1).padStart(5, '0')}`;
  }

  async create(createWaybillDto: CreateWaybillDto, tenantId: string) {
    const { orderId, customerId, issueDate, notes, rollIds, prices } =
      createWaybillDto;

    // Cari kontrolü
    const customer = await this.prisma.account.findFirst({
      where: { id: customerId, tenantId },
    });
    if (!customer)
      throw new NotFoundException('Müşteri cari hesabı bulunamadı.');

    if (!rollIds || rollIds.length === 0) {
      throw new BadRequestException(
        'İrsaliye en az bir kumaş topu içermelidir.',
      );
    }

    // Topları ve durumlarını kontrol edelim
    const rolls = await this.prisma.roll.findMany({
      where: { id: { in: rollIds }, tenantId },
    });

    if (rolls.length !== rollIds.length) {
      throw new BadRequestException(
        'Seçilen kumaş toplarından bazıları bulunamadı.',
      );
    }

    for (const roll of rolls) {
      if (roll.status !== 'available' && roll.status !== 'reserved') {
        throw new BadRequestException(
          `Kumaş topu (Barkod: ${roll.barcodeNumber}) sevk edilmeye uygun değil (durum: ${roll.status}).`,
        );
      }
    }

    // Kartela fiyatlarını çekelim
    const fabricCards = await this.prisma.fabricCard.findMany({
      where: { tenantId },
    });

    // Topları kumaş türlerine göre gruplayalım: "Süprem (Siyah)" vb.
    const groups: {
      [key: string]: { fabricType: string; color: string; rolls: any[] };
    } = {};
    for (const roll of rolls) {
      const key = `${roll.fabricType} (${roll.color})`;
      if (!groups[key]) {
        groups[key] = {
          fabricType: roll.fabricType,
          color: roll.color,
          rolls: [],
        };
      }
      groups[key].rolls.push(roll);
    }

    const waybillItemsToCreate = Object.keys(groups).map((key) => {
      const group = groups[key];
      const quantity = group.rolls.reduce(
        (sum, r) => sum + Number(r.lengthM),
        0,
      );
      const rollCount = group.rolls.length;
      const rollDetails = group.rolls
        .map((r) => Number(r.lengthM).toFixed(2))
        .join(', ');

      // Birim Fiyat Belirleme:
      // 1. Kullanıcı bu kumaş çeşidi için özel fiyat girmiş mi?
      let unitPrice = 0;
      const matchedPrice = prices?.find(
        (p) =>
          p.fabricType.toLowerCase().trim() ===
            group.fabricType.toLowerCase().trim() &&
          p.color.toLowerCase().trim() === group.color.toLowerCase().trim(),
      );

      if (matchedPrice) {
        unitPrice = Number(matchedPrice.unitPrice);
      } else {
        // 2. Özel fiyat girilmemişse, karteladaki varsayılan metre fiyatını al
        const matchedCard = fabricCards.find(
          (fc) =>
            fc.fabricType.toLowerCase().trim() ===
            group.fabricType.toLowerCase().trim(),
        );
        if (matchedCard) {
          unitPrice = Number(matchedCard.pricePerMeter);
        }
      }

      return {
        description: key,
        quantity,
        rollCount,
        rollDetails,
        unitPrice,
      };
    });

    const waybillNumber = await this.generateWaybillNumber(tenantId);

    return this.prisma.$transaction(async (tx) => {
      // 1. İrsaliyeyi oluştur
      const waybill = await (tx as any).waybill.create({
        data: {
          waybillNumber,
          orderId,
          customerId,
          issueDate: new Date(issueDate),
          notes,
          status: 'shipped',
          tenantId,
          waybillItems: {
            create: waybillItemsToCreate,
          },
        },
        include: {
          customer: true,
          order: true,
          waybillItems: true,
        },
      });

      // 2. Sevk edilen topların status ve waybillId değerlerini güncelle
      await tx.roll.updateMany({
        where: { id: { in: rollIds } },
        data: {
          status: 'sold',
          waybillId: waybill.id,
        } as any,
      });

      return waybill;
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
        { waybillNumber: { contains: params.search, mode: 'insensitive' } },
        {
          customer: { name: { contains: params.search, mode: 'insensitive' } },
        },
      ];
    }

    const [data, total] = await Promise.all([
      (this.prisma as any).waybill.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: true,
          order: true,
          waybillItems: true,
        },
      }),
      (this.prisma as any).waybill.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string, tenantId: string) {
    const waybill = await (this.prisma as any).waybill.findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        order: {
          include: {
            orderItems: {
              include: {
                roll: true,
              },
            },
          },
        },
        waybillItems: true,
      },
    });
    if (!waybill) throw new NotFoundException(`İrsaliye bulunamadı.`);
    return waybill;
  }

  async invoiceWaybill(id: string, tenantId: string) {
    const waybill = await this.findOne(id, tenantId);

    if (waybill.status === 'invoiced') {
      throw new BadRequestException('Bu irsaliye zaten faturalandırılmış.');
    }

    const waybillItems = waybill.waybillItems;
    if (!waybillItems || waybillItems.length === 0) {
      throw new BadRequestException(
        'İrsaliyede faturalandırılacak kalem bulunamadı.',
      );
    }

    // Fatura kalemlerini doğrudan irsaliyedeki birim fiyat ve miktarlar üzerinden oluşturuyoruz
    const invoiceItemsToCreate: any[] = [];
    let subtotal = 0;

    for (const wbItem of waybillItems) {
      const unitPrice = Number(wbItem.unitPrice || 0);
      const qty = Number(wbItem.quantity);
      const totalPrice = qty * unitPrice;

      subtotal += totalPrice;

      invoiceItemsToCreate.push({
        description: wbItem.description,
        quantity: qty,
        unitPrice: unitPrice,
        totalPrice: totalPrice,
      });
    }

    const taxRate = 20; // Varsayılan KDV %20
    const taxAmount = (subtotal * taxRate) / 100;
    const totalAmount = subtotal + taxAmount;

    return this.prisma.$transaction(async (tx) => {
      const invoiceNumber = await this.generateInvoiceNumber(tenantId, tx);

      // 1. Fatura oluştur
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          orderId: waybill.orderId,
          customerId: waybill.customerId,
          issueDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 gün vade
          subtotal,
          taxRate,
          taxAmount,
          totalAmount,
          status: 'sent',
          notes: waybill.notes,
          tenantId,
          invoiceItems: {
            create: invoiceItemsToCreate,
          },
        },
        include: {
          customer: true,
          order: true,
          invoiceItems: true,
        },
      });

      // 2. İrsaliye durumunu güncelle
      await (tx as any).waybill.update({
        where: { id },
        data: { status: 'invoiced' },
      });

      // 3. Eğer ilişkili sipariş varsa, sipariş durumunu güncelle
      if (waybill.orderId) {
        await tx.order.update({
          where: { id: waybill.orderId },
          data: { status: 'invoiced' },
        });
      }

      return invoice;
    });
  }
}
