import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { SectionService } from './section.service';
import { ReorderSectionsDto, SectionResponseDto, UpdateSectionDto } from './dto/section.dto';

@ApiTags('tenant')
@ApiBearerAuth()
@Roles(Role.CLIENT)
@Controller('tenant/sections')
export class SectionController {
  constructor(private readonly sections: SectionService) {}

  @Get()
  @ApiOperation({ summary: 'Which sections show on my public site, in what order' })
  @ApiResponse({ status: 200, type: [SectionResponseDto] })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.sections.findAllForTenant(user.tenantId!);
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Reorder all sections at once' })
  @ApiResponse({ status: 200, type: [SectionResponseDto] })
  reorder(@CurrentUser() user: AuthenticatedUser, @Body() dto: ReorderSectionsDto) {
    return this.sections.reorder(user.tenantId!, dto);
  }

  @Patch(':sectionKey')
  @ApiOperation({ summary: 'Show or hide one section on my public site' })
  @ApiResponse({ status: 200, type: [SectionResponseDto] })
  updateOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sectionKey') sectionKey: string,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.sections.updateOne(user.tenantId!, sectionKey, dto.enabled);
  }
}
