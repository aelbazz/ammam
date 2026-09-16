import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PersonService } from './person.service';
import { PersonResponseDto, UpdatePersonDto } from './dto/person.dto';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('person')
@Controller('person')
export class PersonController {
  constructor(private readonly service: PersonService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get the profile owner' })
  @ApiResponse({ status: 200, type: PersonResponseDto })
  @ApiResponse({ status: 404, description: 'Profile not found - run the seed' })
  findOne(): Promise<PersonResponseDto> {
    return this.service.findOne();
  }

  @Patch()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update the profile owner',
    description: 'Person is a singleton, so there is no id in the path and no create/delete.',
  })
  @ApiResponse({ status: 200, type: PersonResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  update(@Body() dto: UpdatePersonDto): Promise<PersonResponseDto> {
    return this.service.update(dto);
  }
}
