import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { CvVersionService } from './cv-version.service';
import { CvBuilderService } from './cv-builder.service';
import { CvExportService } from './cv-export.service';
import {
  CreateCvVersionDto,
  CvVersionResponseDto,
  CvVersionSummaryDto,
  UpdateCvVersionDto,
} from './dto/cv-version.dto';
import { CvDownloadQueryDto } from './dto/cv-download-query.dto';

@ApiTags('tenant')
@ApiBearerAuth()
@Roles(Role.CLIENT)
@Controller('tenant/cv/versions')
export class CvController {
  constructor(
    private readonly versions: CvVersionService,
    private readonly builder: CvBuilderService,
    private readonly cvExport: CvExportService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List my saved CV versions' })
  @ApiResponse({ status: 200, type: [CvVersionSummaryDto] })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.versions.findAll(user.personId!);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new CV version' })
  @ApiResponse({ status: 201, type: CvVersionResponseDto })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCvVersionDto) {
    return this.versions.create(user.personId!, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one CV version configuration' })
  @ApiResponse({ status: 200, type: CvVersionResponseDto })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.versions.findOneOrThrow(user.personId!, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a CV version configuration' })
  @ApiResponse({ status: 200, type: CvVersionResponseDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCvVersionDto,
  ) {
    return this.versions.update(user.personId!, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a CV version' })
  @ApiResponse({ status: 200, description: 'Deleted' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.versions.remove(user.personId!, id);
  }

  @Patch(':id/set-default')
  @ApiOperation({ summary: 'Make this my default CV version (used by the public download button)' })
  @ApiResponse({ status: 200, type: CvVersionResponseDto })
  setDefault(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.versions.setDefault(user.personId!, id);
  }

  @Get(':id/preview')
  @ApiOperation({ summary: 'The normalized CV model - the same shape the PDF/DOCX are built from' })
  async preview(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const version = await this.versions.findOneOrThrow(user.personId!, id);
    return this.builder.build(user.personId!, version);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Generate and download one CV version as PDF or DOCX' })
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: CvDownloadQueryDto,
  ): Promise<StreamableFile> {
    const { buffer, filename, mimeType } = await this.cvExport.generate(
      user.personId!,
      id,
      query.format,
    );
    return new StreamableFile(buffer, {
      type: mimeType,
      disposition: `attachment; filename="${filename}"`,
    });
  }
}
