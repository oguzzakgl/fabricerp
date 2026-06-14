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
import { RollsService } from './rolls.service';
import { CreateRollDto } from './dto/create-roll.dto';
import { UpdateRollDto } from './dto/update-roll.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantId } from '../auth/tenant-id.decorator';

@UseGuards(JwtAuthGuard)
@Controller('rolls')
export class RollsController {
  constructor(private readonly rollsService: RollsService) {}

  @Post()
  create(
    @Body() createRollDto: CreateRollDto,
    @TenantId() tenantId: string,
  ) {
    return this.rollsService.create(createRollDto, tenantId);
  }

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('quality') quality?: string,
  ) {
    return this.rollsService.findAll({ page, limit, search, status, quality }, tenantId);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
  ) {
    return this.rollsService.findOne(id, tenantId);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRollDto: UpdateRollDto,
    @TenantId() tenantId: string,
  ) {
    return this.rollsService.update(id, updateRollDto, tenantId);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
  ) {
    return this.rollsService.remove(id, tenantId);
  }
}
