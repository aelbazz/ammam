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
import { Public } from '../common/decorators/public.decorator';

@ApiTags('management-roles')
@ApiBearerAuth()
@Controller('management-roles')
export class ManagementRoleController {
  constructor(private readonly service: ManagementRoleService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List management roles' })
  @ApiResponse({ status: 200, type: [ManagementRoleResponseDto] })
  findAll(): Promise<ManagementRoleResponseDto[]> {
    return this.service.findAll(false);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get one management role' })
  @ApiResponse({ status: 200, type: ManagementRoleResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@Param('id') id: string): Promise<ManagementRoleResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a management role' })
  @ApiResponse({ status: 201, type: ManagementRoleResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() dto: CreateManagementRoleDto): Promise<ManagementRoleResponseDto> {
    return this.service.create(dto);
  }

  @Patch('reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Bulk-update display order' })
  @ApiResponse({ status: 204, description: 'Reordered' })
  reorder(@Body() dto: ReorderDto): Promise<void> {
    return this.service.reorder(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a management role' })
  @ApiResponse({ status: 200, type: ManagementRoleResponseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateManagementRoleDto,
  ): Promise<ManagementRoleResponseDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a management role and its children' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  remove(@Param('id') id: string): Promise<void> {
    return this.service.remove(id);
  }
}
