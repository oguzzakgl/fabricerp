import {
  Controller,
  Get,
  Body,
  Post,
  Delete,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  SettingsService,
  UpdateSettingsDto,
  CreateUserDto,
} from './settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantId } from '../auth/tenant-id.decorator';

export interface RequestWithUser {
  user: {
    userId: string;
    email: string;
    role: string;
  };
}

@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get()
  getSettings(@TenantId() tenantId: string) {
    return this.settingsService.getSettings(tenantId);
  }

  @Post()
  updateSettings(
    @TenantId() tenantId: string,
    @Body() body: UpdateSettingsDto,
  ) {
    return this.settingsService.updateSettings(tenantId, body);
  }

  @Get('users')
  getUsers(@TenantId() tenantId: string) {
    return this.settingsService.getUsers(tenantId);
  }

  @Post('users')
  createUser(@TenantId() tenantId: string, @Body() body: CreateUserDto) {
    return this.settingsService.createUser(tenantId, body);
  }

  @Delete('users/:id')
  deleteUser(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.settingsService.deleteUser(tenantId, id, req.user.userId);
  }

  @Get('super/stats')
  superGetStats(@Req() req: RequestWithUser) {
    return this.settingsService.superGetStats(req.user.userId);
  }

  @Get('super/tenants')
  superGetTenants(@Req() req: RequestWithUser) {
    return this.settingsService.superGetTenants(req.user.userId);
  }

  @Get('super/users')
  superGetUsers(@Req() req: RequestWithUser) {
    return this.settingsService.superGetUsers(req.user.userId);
  }

  @Get('super/invites')
  superGetInvites(@Req() req: RequestWithUser) {
    return this.settingsService.superGetInvites(req.user.userId);
  }

  @Post('super/invites')
  superCreateInvite(@Req() req: RequestWithUser, @Body('code') code: string) {
    return this.settingsService.superCreateInvite(req.user.userId, code);
  }

  @Delete('super/invites/:id')
  superDeleteInvite(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.settingsService.superDeleteInvite(req.user.userId, id);
  }
}
