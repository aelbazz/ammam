import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ManagementRoleService } from './management-role.service';
import {
  CreateManagementRoleDto,
  ManagementRoleResponseDto,
  UpdateManagementRoleDto,
} from './dto/management-role.dto';
import { ReorderDto } from '../experience/dto/experience.dto';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('management-roles')
@ApiBearerAuth()
@Roles(Role.CLIENT)
@Controller('tenant/management-roles')
export class ManagementRoleController {
  constructor(private readonly service: ManagementRoleService) {}

  @Get()
  @ApiOperation({ summary: 'List management roles' })
  @ApiResponse({ status: 200, type: [ManagementRoleResponseDto] })
  findAll(@CurrentUser() user: AuthenticatedUser): Promise<ManagementRoleResponseDto[]> {
    return this.service.findAll(user.personId!);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one management role' })
  @ApiResponse({ status: 200, type: ManagementRoleResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ManagementRoleResponseDto> {
    return this.service.findOne(user.personId!, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a management role' })
  @ApiResponse({ status: 201, type: ManagementRoleResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateManagementRoleDto,
  ): Promise<ManagementRoleResponseDto> {
    return this.service.create(user.personId!, dto);
  }

  @Patch('reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Bulk-update display order' })
  @ApiResponse({ status: 204, description: 'Reordered' })
  reorder(@CurrentUser() user: AuthenticatedUser, @Body() dto: ReorderDto): Promise<void> {
    return this.service.reorder(user.personId!, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a management role' })
  @ApiResponse({ status: 200, type: ManagementRoleResponseDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateManagementRoleDto,
  ): Promise<ManagementRoleResponseDto> {
    return this.service.update(user.personId!, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a management role and its children' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    return this.service.remove(user.personId!, id);
  }
}
