import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { TenantService } from './tenant.service';
import {
  CreateTenantAsCoordinatorDto,
  TenantResponseDto,
  UpdateTenantAsCoordinatorDto,
} from './dto/tenant.dto';

@ApiTags('coordinator')
@ApiBearerAuth()
@Roles(Role.COORDINATOR)
@Controller('coordinator/tenants')
export class CoordinatorTenantController {
  constructor(private readonly tenants: TenantService) {}

  @Get()
  @ApiOperation({ summary: 'List tenants assigned to me' })
  @ApiResponse({ status: 200, type: [TenantResponseDto] })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.tenants.findAllForCoordinator(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one tenant assigned to me' })
  @ApiResponse({ status: 200, type: TenantResponseDto })
  @ApiResponse({ status: 404, description: 'Not found, or not assigned to you' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.tenants.findOneForCoordinator(user.id, id);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a tenant',
    description: 'Automatically assigned to me. An Admin can reassign it later.',
  })
  @ApiResponse({ status: 201, type: TenantResponseDto })
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateTenantAsCoordinatorDto) {
    return this.tenants.create(actor, dto, { coordinatorId: actor.id });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update the name of a tenant assigned to me' })
  @ApiResponse({ status: 200, type: TenantResponseDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTenantAsCoordinatorDto,
  ) {
    return this.tenants.updateAsCoordinator(user, user.id, id, dto);
  }
}
