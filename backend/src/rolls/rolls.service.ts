import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRollDto } from './dto/create-roll.dto';
import { UpdateRollDto } from './dto/update-roll.dto';

@Injectable()
export class RollsService {
  constructor(private prisma: PrismaService) {}

  async create(createRollDto: CreateRollDto, tenantId: string) {
    const { warpYarnId, weftYarnId, warpKg, weftKg, ...rollData } = createRollDto;

    // Check barcode uniqueness
    const existing = await this.prisma.roll.findUnique({
      where: { barcodeNumber: rollData.barcodeNumber },
    });
    if (existing) {
      throw new ConflictException(`Barkod numarası '${rollData.barcodeNumber}' zaten kullanımda.`);
    }

    const hasRecipe = !!(warpYarnId && weftYarnId && warpKg !== undefined && weftKg !== undefined);

    let warpYarn = null;
    let weftYarn = null;
    let costPrice = 0;

    if (hasRecipe) {
      // Validate yarn stocks under this tenant
      warpYarn = await this.prisma.yarnStock.findFirst({ where: { id: warpYarnId, tenantId } });
      if (!warpYarn) throw new NotFoundException(`Çözgü ipliği (ID: ${warpYarnId}) bulunamadı.`);

      weftYarn = await this.prisma.yarnStock.findFirst({ where: { id: weftYarnId, tenantId } });
      if (!weftYarn) throw new NotFoundException(`Atkı ipliği (ID: ${weftYarnId}) bulunamadı.`);

      // Check sufficient stock
      if (Number(warpYarn.currentKg) < Number(warpKg)) {
        throw new BadRequestException(
          `Çözgü ipliği stok yetersiz. Mevcut: ${warpYarn.currentKg} kg, İstenen: ${warpKg} kg.`,
        );
      }
      if (Number(weftYarn.currentKg) < Number(weftKg)) {
        throw new BadRequestException(
          `Atkı ipliği stok yetersiz. Mevcut: ${weftYarn.currentKg} kg, İstenen: ${weftKg} kg.`,
        );
      }

      // Calculate cost price
      costPrice =
        Number(warpKg) * Number(warpYarn.unitPrice) +
        Number(weftKg) * Number(weftYarn.unitPrice);
    }

    // Atomic transaction: create roll + recipe (optional), deduct yarn stocks (optional)
    return this.prisma.$transaction(async (tx) => {
      const roll = await tx.roll.create({
        data: {
          ...rollData,
          costPrice,
          tenantId,
          ...(hasRecipe && {
            productionRecipe: {
              create: {
                warpYarnId,
                weftYarnId,
                warpKg,
                weftKg,
              },
            },
          }),
        },
        include: {
          productionRecipe: {
            include: {
              warpYarn: { include: { supplier: true } },
              weftYarn: { include: { supplier: true } },
            },
          },
        },
      });

      if (hasRecipe) {
        // Deduct yarn stocks
        await tx.yarnStock.update({
          where: { id: warpYarnId },
          data: { currentKg: { decrement: Number(warpKg) } },
        });

        await tx.yarnStock.update({
          where: { id: weftYarnId },
          data: { currentKg: { decrement: Number(weftKg) } },
        });
      }

      return roll;
    });
  }

  async findAll(
    params: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      quality?: string;
    },
    tenantId: string,
  ) {
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (params.status) where.status = params.status;
    if (params.quality) where.quality = params.quality;

    if (params.search) {
      where.OR = [
        { barcodeNumber: { contains: params.search, mode: 'insensitive' } },
        { fabricType: { contains: params.search, mode: 'insensitive' } },
        { color: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.roll.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          productionRecipe: {
            include: {
              warpYarn: true,
              weftYarn: true,
            },
          },
        },
      }),
      this.prisma.roll.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string, tenantId: string) {
    const roll = await this.prisma.roll.findFirst({
      where: { id, tenantId },
      include: {
        productionRecipe: {
          include: {
            warpYarn: { include: { supplier: true } },
            weftYarn: { include: { supplier: true } },
          },
        },
      },
    });
    if (!roll) throw new NotFoundException(`ID'si '${id}' olan Kumaş topu bulunamadı.`);
    return roll;
  }

  async update(id: string, updateRollDto: UpdateRollDto, tenantId: string) {
    await this.findOne(id, tenantId);
    const { warpYarnId, weftYarnId, warpKg, weftKg, ...rollData } = updateRollDto;
    return this.prisma.roll.update({
      where: { id },
      data: rollData,
      include: {
        productionRecipe: {
          include: { warpYarn: true, weftYarn: true },
        },
      },
    });
  }

  async remove(id: string, tenantId: string) {
    const roll = await this.findOne(id, tenantId);
    if (roll.status === 'sold') {
      throw new BadRequestException('Satılmış kumaş topu silinemez.');
    }
    return this.prisma.roll.delete({ where: { id } });
  }
}
