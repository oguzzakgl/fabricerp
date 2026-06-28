import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

interface RequestWithUser {
  user: {
    userId: string;
    email: string;
    role: string;
    tenantId?: string | null;
  };
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('request-invite')
  requestInvite(@Body('email') email: string) {
    return this.authService.requestInvite(email);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: RequestWithUser) {
    return this.authService.me(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('onboarding')
  completeOnboarding(
    @Req() req: RequestWithUser,
    @Body() dto: { name: string; tenantName: string },
  ) {
    return this.authService.completeOnboarding(req.user.userId, dto);
  }
}
