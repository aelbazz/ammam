import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role, TenantStatus } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { TenantService } from './tenant.service';
import {
  AssignCoordinatorDto,
  CreateTenantDto,
  TenantResponseDto,
  UpdateTenantDto,
  UpdateTenantStatusDto,
} from './dto/tenant.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/tenants')
export class AdminTenantController {
  constructor(private readonly tenants: TenantService) {}

  @Get()
  @ApiOperation({ summary: 'List every tenant on the platform' })
  @ApiQuery({ name: 'status', required: false, enum: TenantStatus })
  @ApiQuery({ name: 'coordinatorId', required: false })
  @ApiResponse({ status: 200, type: [TenantResponseDto] })
  findAll(@Query('status') status?: TenantStatus, @Query('coordinatorId') coordinatorId?: string) {
    return this.tenants.findAllForAdmin({ status, coordinatorId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one tenant' })
  @ApiResponse({ status: 200, type: TenantResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@Param('id') id: string) {
    return this.tenants.findOneForAdmin(id);
  }

  @Get(':id/activity')
  @ApiOperation({ summary: "This tenant's audit trail" })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getActivity(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.tenants.getActivity(
      id,
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
    );
  }

  @Post()
  @ApiOperation({
    summary: 'Create a tenant (client)',
    description:
      'Creates the tenant, its placeholder profile, its CLIENT login, a trial subscription, ' +
      'and default theme/settings - all in one transaction.',
  })
  @ApiResponse({ status: 201, type: TenantResponseDto })
  @ApiResponse({ status: 409, description: 'Slug or client email already in use' })
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateTenantDto) {
    return this.tenants.create(actor, dto, {
      coordinatorId: dto.coordinatorId ?? null,
      planId: dto.planId,
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update tenant metadata (name, slug)' })
  @ApiResponse({ status: 200, type: TenantResponseDto })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenants.updateAsAdmin(actor, id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Change tenant lifecycle status',
    description:
      'Transitions are validated: PENDING -> ACTIVE -> SUSPENDED <-> ACTIVE -> ARCHIVED (terminal).',
  })
  @ApiResponse({ status: 200, type: TenantResponseDto })
  @ApiResponse({ status: 400, description: 'Not a valid transition from the current status' })
  updateStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTenantStatusDto,
  ) {
    return this.tenants.updateStatus(actor, id, dto.status);
  }

  @Patch(':id/coordinator')
  @ApiOperation({ summary: 'Assign or reassign the coordinator for this tenant' })
  @ApiResponse({ status: 200, type: TenantResponseDto })
  updateCoordinator(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssignCoordinatorDto,
  ) {
    return this.tenants.updateCoordinator(actor, id, dto.coordinatorId ?? null);
  }

  @Post(':id/reset-access')
  @ApiOperation({
    summary: "Generate a new temporary password for the tenant's client account",
    description:
      'The password is returned once, in plain text, and never logged or stored anywhere.',
  })
  @ApiResponse({ status: 201, description: '{ temporaryPassword: string }' })
  resetAccess(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.tenants.resetClientAccess(actor, id);
  }
}
