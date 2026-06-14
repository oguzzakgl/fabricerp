import { Controller, Get, Post, Body, Put, Param, Delete, Query, ParseUUIDPipe, UseGuards, ParseArrayPipe } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantId } from '../auth/tenant-id.decorator';

@UseGuards(JwtAuthGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  create(
    @Body() createAccountDto: CreateAccountDto,
    @TenantId() tenantId: string,
  ) {
    return this.accountsService.create(createAccountDto, tenantId);
  }

  @Post('bulk')
  createBulk(
    @Body(new ParseArrayPipe({ items: CreateAccountDto })) dtos: CreateAccountDto[],
    @TenantId() tenantId: string,
  ) {
    return this.accountsService.createBulk(dtos, tenantId);
  }

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('type') type?: string,
  ) {
    return this.accountsService.findAll({ page, limit, search, type }, tenantId);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
  ) {
    return this.accountsService.findOne(id, tenantId);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAccountDto: UpdateAccountDto,
    @TenantId() tenantId: string,
  ) {
    return this.accountsService.update(id, updateAccountDto, tenantId);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
  ) {
    return this.accountsService.remove(id, tenantId);
  }
}
