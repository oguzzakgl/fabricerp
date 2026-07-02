import {
  Controller,
  Get,
  Body,
  Post,
  Patch,
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
  superCreateInvite(
    @Req() req: RequestWithUser,
    @Body('code') code: string,
    @Body('plan') plan?: string,
  ) {
    return this.settingsService.superCreateInvite(req.user.userId, code, plan);
  }

  @Delete('super/invites/:id')
  superDeleteInvite(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.settingsService.superDeleteInvite(req.user.userId, id);
  }

  @Post('super/tenants')
  superCreateTenant(
    @Req() req: RequestWithUser,
    @Body()
    body: { tenantName: string; adminEmail: string; adminPassword: string },
  ) {
    return this.settingsService.superCreateTenant(req.user.userId, body);
  }

  @Get('super/tenants/:id')
  superGetTenant(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.settingsService.superGetTenant(req.user.userId, id);
  }

  @Patch('super/users/:id/password')
  superUpdateUserPassword(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.settingsService.superUpdateUserPassword(
      req.user.userId,
      id,
      newPassword,
    );
  }

  @Patch('super/users/:id/email')
  superUpdateUserEmail(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body('newEmail') newEmail: string,
  ) {
    return this.settingsService.superUpdateUserEmail(
      req.user.userId,
      id,
      newEmail,
    );
  }

  @Post('super/tenants/:tenantId/users')
  superAddUserToTenant(
    @Req() req: RequestWithUser,
    @Param('tenantId') tenantId: string,
    @Body() body: CreateUserDto,
  ) {
    return this.settingsService.superAddUserToTenant(
      req.user.userId,
      tenantId,
      body,
    );
  }

  @Delete('super/users/:id')
  superDeleteUser(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.settingsService.superDeleteUser(req.user.userId, id);
  }

  @Patch('super/tenants/:tenantId/settings')
  superUpdateTenantSettings(
    @Req() req: RequestWithUser,
    @Param('tenantId') tenantId: string,
    @Body()
    body: {
      geminiApiKey: string;
      geminiPrompt?: string;
      geminiYarnPrompt?: string;
    },
  ) {
    return this.settingsService.superUpdateTenantSettings(
      req.user.userId,
      tenantId,
      body,
    );
  }
}
