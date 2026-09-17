import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PersonService } from './person.service';
import { PersonResponseDto, UpdatePersonDto } from './dto/person.dto';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('person')
@ApiBearerAuth()
@Controller('person')
export class PersonController {
  constructor(private readonly service: PersonService) {}

  @Get()
  @ApiOperation({ summary: 'Get the profile owner' })
  @ApiResponse({ status: 200, type: PersonResponseDto })
  @ApiResponse({ status: 404, description: 'Profile not found - run the seed' })
  findOne(@CurrentUser() user: AuthenticatedUser): Promise<PersonResponseDto> {
    return this.service.findOne(user.personId);
  }

  @Patch()
  @ApiOperation({
    summary: 'Update the profile owner',
    description:
      'The tenant is taken from the bearer token, so there is no id in the path and an ' +
      'administrator can only ever update their own profile.',
  })
  @ApiResponse({ status: 200, type: PersonResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePersonDto,
  ): Promise<PersonResponseDto> {
    return this.service.update(user.personId, dto);
  }
}
