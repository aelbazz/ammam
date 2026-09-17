import { Body, Controller, Get, Patch, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContactService } from './contact.service';
import { ContactResponseDto, UpdateContactDto, UpsertContactDto } from './dto/contact.dto';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('contact')
@ApiBearerAuth()
@Roles(Role.CLIENT)
@Controller('tenant/contact')
export class ContactController {
  constructor(private readonly service: ContactService) {}

  @Get()
  @ApiOperation({ summary: 'Get contact information' })
  @ApiResponse({ status: 200, type: ContactResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@CurrentUser() user: AuthenticatedUser): Promise<ContactResponseDto> {
    return this.service.findOne(user.personId!);
  }

  @Put()
  @ApiOperation({ summary: 'Create or replace contact information' })
  @ApiResponse({ status: 200, type: ContactResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  upsert(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertContactDto,
  ): Promise<ContactResponseDto> {
    return this.service.upsert(user.personId!, dto);
  }

  @Patch()
  @ApiOperation({
    summary: 'Partially update contact information',
    description: 'socialLinks is only replaced when the field is present in the request body.',
  })
  @ApiResponse({ status: 200, type: ContactResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateContactDto,
  ): Promise<ContactResponseDto> {
    return this.service.update(user.personId!, dto);
  }
}
