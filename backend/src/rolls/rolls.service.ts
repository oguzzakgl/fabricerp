import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRollDto } from './dto/create-roll.dto';
import { UpdateRollDto } from './dto/update-roll.dto';

@Injectable()
export class RollsService {
  constructor(private prisma: PrismaService) {}

  async create(createRollDto: CreateRollDto, tenantId: string) {
    const { warpYarnId, weftYarnId, warpKg, weftKg, ...rollData } =
      createRollDto;

    // Check barcode uniqueness
    const existing = await this.prisma.roll.findUnique({
      where: { barcodeNumber: rollData.barcodeNumber },
    });
    if (existing) {
      throw new ConflictException(
        `Barkod numarası '${rollData.barcodeNumber}' zaten kullanımda.`,
      );
    }

    // Renk çözme mantığı (Dinamik Renk Kartelası Eşleştirmesi)
    let finalColor = rollData.color;
    const normalizedFabricType = rollData.fabricType
      .trim()
      .toLocaleUpperCase('tr-TR');
    try {
      const fabricCard = tenantId
        ? await this.prisma.fabricCard.findUnique({
            where: {
              fabricType_tenantId: {
                fabricType: normalizedFabricType,
                tenantId,
              },
            },
          })
        : null;

      if (fabricCard && fabricCard.colorMapping) {
        const mapping = fabricCard.colorMapping as Record<string, string>;
        const trimmedColor = rollData.color.trim();
        if (mapping[trimmedColor]) {
          finalColor = `Renk ${trimmedColor} - ${mapping[trimmedColor]}`;
        } else if (/^\d+$/.test(trimmedColor)) {
          finalColor = `Renk ${trimmedColor}`;
        }
      } else if (/^\d+$/.test(rollData.color.trim())) {
        finalColor = `Renk ${rollData.color.trim()}`;
      }
    } catch (err) {
      console.error('Error resolving fabric card color mapping:', err);
    }

    const hasRecipe = !!(
      warpYarnId &&
      weftYarnId &&
      warpKg !== undefined &&
      weftKg !== undefined
    );

    let warpYarn = null;
    let weftYarn = null;
    let costPrice = 0;

    if (hasRecipe) {
      // Validate yarn stocks under this tenant
      warpYarn = await this.prisma.yarnStock.findFirst({
        where: { id: warpYarnId, tenantId },
      });
      if (!warpYarn)
        throw new NotFoundException(
          `Çözgü ipliği (ID: ${warpYarnId}) bulunamadı.`,
        );

      weftYarn = await this.prisma.yarnStock.findFirst({
        where: { id: weftYarnId, tenantId },
      });
      if (!weftYarn)
        throw new NotFoundException(
          `Atkı ipliği (ID: ${weftYarnId}) bulunamadı.`,
        );

      // Check sufficient stock
      if (Number(warpYarn.currentKg) < Number(warpKg)) {
        throw new BadRequestException(
          `Çözgü ipliği stok yetersiz. Mevcut: ${warpYarn.currentKg.toString()} kg, İstenen: ${warpKg} kg.`,
        );
      }
      if (Number(weftYarn.currentKg) < Number(weftKg)) {
        throw new BadRequestException(
          `Atkı ipliği stok yetersiz. Mevcut: ${weftYarn.currentKg.toString()} kg, İstenen: ${weftKg} kg.`,
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
          fabricType: normalizedFabricType,
          color: finalColor,
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
      includeRecipe?: boolean;
    },
    tenantId: string,
  ) {
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.RollWhereInput = { tenantId };

    if (params.status) where.status = params.status;
    if (params.quality) where.quality = params.quality;

    if (params.search) {
      where.OR = [
        { barcodeNumber: { contains: params.search, mode: 'insensitive' } },
        { fabricType: { contains: params.search, mode: 'insensitive' } },
        { color: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const includeRecipeOpt =
      params.includeRecipe === true || params.includeRecipe === ('true' as any);

    const [data, total] = await Promise.all([
      this.prisma.roll.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        ...(includeRecipeOpt && {
          include: {
            productionRecipe: {
              include: {
                warpYarn: true,
                weftYarn: true,
              },
            },
          },
        }),
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
    if (!roll)
      throw new NotFoundException(`ID'si '${id}' olan Kumaş topu bulunamadı.`);
    return roll;
  }

  async update(id: string, updateRollDto: UpdateRollDto, tenantId: string) {
    await this.findOne(id, tenantId);
    const rollData = { ...updateRollDto };
    delete rollData.warpYarnId;
    delete rollData.weftYarnId;
    delete rollData.warpKg;
    delete rollData.weftKg;
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
