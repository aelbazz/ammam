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
import { TechnologyService } from './technology.service';
import {
  CreateTechnologyDto,
  TechnologyResponseDto,
  UpdateTechnologyDto,
} from './dto/technology.dto';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('technologies')
@ApiBearerAuth()
@Roles(Role.CLIENT)
@Controller('tenant/technologies')
export class TechnologyController {
  constructor(private readonly service: TechnologyService) {}

  @Get()
  @ApiOperation({ summary: 'List all technologies with usage counts' })
  @ApiResponse({ status: 200, type: [TechnologyResponseDto] })
  findAll(@CurrentUser() user: AuthenticatedUser): Promise<TechnologyResponseDto[]> {
    return this.service.findAll(user.personId!);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one technology' })
  @ApiResponse({ status: 200, type: TechnologyResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<TechnologyResponseDto> {
    return this.service.findOne(user.personId!, id);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a technology',
    description: 'Idempotent: returns the existing technology when the name already resolves.',
  })
  @ApiResponse({ status: 201, type: TechnologyResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTechnologyDto,
  ): Promise<TechnologyResponseDto> {
    return this.service.create(user.personId!, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename a technology' })
  @ApiResponse({ status: 200, type: TechnologyResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTechnologyDto,
  ): Promise<TechnologyResponseDto> {
    return this.service.update(user.personId!, id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a technology',
    description: 'Also detaches it from every experience and project.',
  })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    return this.service.remove(user.personId!, id);
  }
}
