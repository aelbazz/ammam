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

@ApiTags('technologies')
@ApiBearerAuth()
@Controller('technologies')
export class TechnologyController {
  constructor(private readonly service: TechnologyService) {}

  @Get()
  @ApiOperation({ summary: 'List all technologies with usage counts' })
  @ApiResponse({ status: 200, type: [TechnologyResponseDto] })
  findAll(): Promise<TechnologyResponseDto[]> {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one technology' })
  @ApiResponse({ status: 200, type: TechnologyResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@Param('id') id: string): Promise<TechnologyResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a technology',
    description: 'Idempotent: returns the existing technology when the name already resolves.',
  })
  @ApiResponse({ status: 201, type: TechnologyResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() dto: CreateTechnologyDto): Promise<TechnologyResponseDto> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename a technology' })
  @ApiResponse({ status: 200, type: TechnologyResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTechnologyDto,
  ): Promise<TechnologyResponseDto> {
    return this.service.update(id, dto);
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
  remove(@Param('id') id: string): Promise<void> {
    return this.service.remove(id);
  }
}
