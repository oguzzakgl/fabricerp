import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { YarnStocksService } from './yarn-stocks.service';
import { CreateYarnStockDto } from './dto/create-yarn-stock.dto';
import { UpdateYarnStockDto } from './dto/update-yarn-stock.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantId } from '../auth/tenant-id.decorator';

@UseGuards(JwtAuthGuard)
@Controller('yarn-stocks')
export class YarnStocksController {
  constructor(private readonly yarnStocksService: YarnStocksService) {}

  @Post()
  create(
    @Body() createYarnStockDto: CreateYarnStockDto,
    @TenantId() tenantId: string,
  ) {
    return this.yarnStocksService.create(createYarnStockDto, tenantId);
  }

  @Get('stats')
  getStats(@TenantId() tenantId: string) {
    return this.yarnStocksService.getStats(tenantId);
  }

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('supplierId') supplierId?: string,
  ) {
    return this.yarnStocksService.findAll(
      { page, limit, search, supplierId },
      tenantId,
    );
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
  ) {
    return this.yarnStocksService.findOne(id, tenantId);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateYarnStockDto: UpdateYarnStockDto,
    @TenantId() tenantId: string,
  ) {
    return this.yarnStocksService.update(id, updateYarnStockDto, tenantId);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @TenantId() tenantId: string) {
    return this.yarnStocksService.remove(id, tenantId);
  }
}
