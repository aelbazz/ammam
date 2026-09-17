import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { UserService } from './user.service';
import {
  CreateAdminDto,
  CreateCoordinatorDto,
  UpdateUserStatusDto,
  UserResponseDto,
} from './dto/user.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminUserController {
  constructor(private readonly users: UserService) {}

  @Get('users')
  @ApiOperation({ summary: 'List every platform user' })
  @ApiQuery({ name: 'role', required: false, enum: Role })
  @ApiResponse({ status: 200, type: [UserResponseDto] })
  listUsers(@Query('role') role?: Role) {
    return this.users.listAll(role);
  }

  @Get('coordinators')
  @ApiOperation({ summary: 'List coordinators' })
  @ApiResponse({ status: 200, type: [UserResponseDto] })
  listCoordinators() {
    return this.users.listAll(Role.COORDINATOR);
  }

  @Post('coordinators')
  @ApiOperation({ summary: 'Create a coordinator account' })
  @ApiResponse({ status: 201, type: UserResponseDto })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  createCoordinator(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateCoordinatorDto) {
    return this.users.createCoordinator(actor, dto);
  }

  @Get('admins')
  @ApiOperation({ summary: 'List platform administrators' })
  @ApiResponse({ status: 200, type: [UserResponseDto] })
  listAdmins() {
    return this.users.listAll(Role.ADMIN);
  }

  @Post('admins')
  @ApiOperation({
    summary: 'Create another platform administrator',
    description: 'The first Admin is bootstrapped by the seed script, not this endpoint.',
  })
  @ApiResponse({ status: 201, type: UserResponseDto })
  createAdmin(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateAdminDto) {
    return this.users.createAdmin(actor, dto);
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Activate or suspend any platform user (ADMIN, COORDINATOR or CLIENT)' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  updateStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.users.updateStatus(actor, id, dto.status);
  }
}
