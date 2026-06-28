import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { WaybillsService } from './waybills.service';
import { CreateWaybillDto } from './dto/create-waybill.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantId } from '../auth/tenant-id.decorator';

@UseGuards(JwtAuthGuard)
@Controller('waybills')
export class WaybillsController {
  constructor(private readonly waybillsService: WaybillsService) {}

  @Post()
  create(
    @Body() createWaybillDto: CreateWaybillDto,
    @TenantId() tenantId: string,
  ) {
    return this.waybillsService.create(createWaybillDto, tenantId);
  }

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
  ) {
    return this.waybillsService.findAll(
      { page, limit, search, customerId, status },
      tenantId,
    );
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
  ) {
    return this.waybillsService.findOne(id, tenantId);
  }

  @Post(':id/invoice')
  invoice(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
  ) {
    return this.waybillsService.invoiceWaybill(id, tenantId);
  }
}
