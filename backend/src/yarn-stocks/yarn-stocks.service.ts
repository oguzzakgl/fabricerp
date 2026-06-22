import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateYarnStockDto } from './dto/create-yarn-stock.dto';
import { UpdateYarnStockDto } from './dto/update-yarn-stock.dto';

@Injectable()
export class YarnStocksService {
  constructor(private prisma: PrismaService) {}

  async create(createYarnStockDto: CreateYarnStockDto, tenantId: string) {
    // Verify supplier exists and is a supplier under this tenant
    const supplier = await this.prisma.account.findFirst({
      where: { id: createYarnStockDto.supplierId, tenantId },
    });
    if (!supplier) {
      throw new NotFoundException(`Tedarikçi Cari hesabı bulunamadı.`);
    }
    if (supplier.type !== 'SUPPLIER' && supplier.type !== 'BOTH') {
      throw new BadRequestException(`Seçilen Cari hesabın tipi SUPPLIER veya BOTH olmalıdır.`);
    }

    return this.prisma.yarnStock.create({
      data: {
        ...createYarnStockDto,
        currentKg: createYarnStockDto.initialKg, // Initially current_kg = initial_kg
        tenantId,
      },
      include: {
        supplier: true,
      },
    });
  }

  async findAll(
    params: {
      page?: number;
      limit?: number;
      search?: string;
      supplierId?: string;
    },
    tenantId: string,
  ) {
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (params.supplierId) {
      where.supplierId = params.supplierId;
    }

    if (params.search) {
      where.OR = [
        { yarnType: { contains: params.search, mode: 'insensitive' } },
        { lotNumber: { contains: params.search, mode: 'insensitive' } },
        { color: { contains: params.search, mode: 'insensitive' } },
        { supplier: { name: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.yarnStock.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: true,
        },
      }),
      this.prisma.yarnStock.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string, tenantId: string) {
    const yarnStock = await this.prisma.yarnStock.findFirst({
      where: { id, tenantId },
      include: {
        supplier: true,
      },
    });
    if (!yarnStock) {
      throw new NotFoundException(`ID'si '${id}' olan İplik envanter kaydı bulunamadı.`);
    }
    return yarnStock;
  }

  async update(id: string, updateYarnStockDto: UpdateYarnStockDto, tenantId: string) {
    await this.findOne(id, tenantId);

    if (updateYarnStockDto.supplierId) {
      const supplier = await this.prisma.account.findFirst({
        where: { id: updateYarnStockDto.supplierId, tenantId },
      });
      if (!supplier) {
        throw new NotFoundException(`Tedarikçi Cari hesabı bulunamadı.`);
      }
      if (supplier.type !== 'SUPPLIER' && supplier.type !== 'BOTH') {
        throw new BadRequestException(`Seçilen Cari hesabın tipi SUPPLIER veya BOTH olmalıdır.`);
      }
    }

    return this.prisma.yarnStock.update({
      where: { id },
      data: updateYarnStockDto,
      include: {
        supplier: true,
      },
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.yarnStock.delete({
      where: { id },
    });
  }

  async getStats(tenantId: string) {
    const aggregate = await this.prisma.yarnStock.aggregate({
      where: { tenantId },
      _sum: {
        currentKg: true,
      },
    });

    const totalKg = Number(aggregate._sum.currentKg || 0);

    const activeLots = await this.prisma.yarnStock.count({
      where: {
        tenantId,
        currentKg: { gt: 0 },
      },
    });

    const totalValueResult = await this.prisma.$queryRaw<any[]>`
      SELECT SUM(CAST(current_kg AS double precision) * CAST(unit_price AS double precision)) as "totalValue"
      FROM yarn_stocks
      WHERE tenant_id = ${tenantId}::uuid
    `;
    const totalValueUsd = Number(totalValueResult[0]?.totalValue || 0);

    const criticalCount = await this.prisma.yarnStock.count({
      where: {
        tenantId,
        currentKg: {
          gt: 0,
          lte: 100,
        },
      },
    });

    return {
      totalKg,
      activeLots,
      totalValueUsd,
      criticalCount,
    };
  }
}
