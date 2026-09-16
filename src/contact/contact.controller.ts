import { Body, Controller, Get, Patch, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContactService } from './contact.service';
import { ContactResponseDto, UpdateContactDto, UpsertContactDto } from './dto/contact.dto';

@ApiTags('contact')
@ApiBearerAuth()
@Controller('contact')
export class ContactController {
  constructor(private readonly service: ContactService) {}

  @Get()
  @ApiOperation({ summary: 'Get contact information' })
  @ApiResponse({ status: 200, type: ContactResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(): Promise<ContactResponseDto> {
    return this.service.findOne();
  }

  @Put()
  @ApiOperation({ summary: 'Create or replace contact information' })
  @ApiResponse({ status: 200, type: ContactResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  upsert(@Body() dto: UpsertContactDto): Promise<ContactResponseDto> {
    return this.service.upsert(dto);
  }

  @Patch()
  @ApiOperation({
    summary: 'Partially update contact information',
    description: 'socialLinks is only replaced when the field is present in the request body.',
  })
  @ApiResponse({ status: 200, type: ContactResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  update(@Body() dto: UpdateContactDto): Promise<ContactResponseDto> {
    return this.service.update(dto);
  }
}
