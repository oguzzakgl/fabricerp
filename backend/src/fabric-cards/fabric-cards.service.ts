import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertFabricCardDto } from './dto/upsert-fabric-card.dto';

@Injectable()
export class FabricCardsService {
  constructor(private prisma: PrismaService) {}

  async upsert(dto: UpsertFabricCardDto, tenantId: string) {
    const { fabricType, pricePerMeter, imageUrl, colorMapping } = dto;

    return this.prisma.fabricCard.upsert({
      where: {
        fabricType_tenantId: {
          fabricType: fabricType.trim(),
          tenantId,
        },
      },
      create: {
        fabricType: fabricType.trim(),
        pricePerMeter: pricePerMeter ?? 0,
        imageUrl: imageUrl ?? null,
        colorMapping: (colorMapping as Prisma.InputJsonValue) ?? {},
        tenantId,
      },
      update: {
        pricePerMeter: pricePerMeter !== undefined ? pricePerMeter : undefined,
        imageUrl: imageUrl !== undefined ? imageUrl : undefined,
        colorMapping:
          colorMapping !== undefined
            ? (colorMapping as Prisma.InputJsonValue)
            : undefined,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.fabricCard.findMany({
      where: { tenantId },
      orderBy: { fabricType: 'asc' },
    });
  }

  async findOne(fabricType: string, tenantId: string) {
    return this.prisma.fabricCard.findUnique({
      where: {
        fabricType_tenantId: {
          fabricType: fabricType.trim(),
          tenantId,
        },
      },
    });
  }
}
