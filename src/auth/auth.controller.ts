import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AuthUserDto, LoginResponseDto } from './dto/auth-response.dto';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  // Far stricter than the global budget: login is the one endpoint worth brute-forcing.
  // Overrides the 'default' throttler for this route only - see app.module.ts.
  @Throttle({ default: { limit: Number(process.env.AUTH_THROTTLE_LIMIT ?? 5), ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Authenticate and receive a JWT',
    description: 'One endpoint for every role - ADMIN, COORDINATOR and CLIENT all sign in here.',
  })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many login attempts' })
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Return the currently authenticated user, including their role and tenant',
  })
  @ApiResponse({ status: 200, type: AuthUserDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  me(@CurrentUser() user: AuthenticatedUser): AuthUserDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      tenantSlug: user.tenantSlug,
    };
  }
}
