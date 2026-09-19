import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { DESIGN_SYSTEMS, LAYOUTS } from './design-registry';
import { DesignRegistryResponseDto } from './dto/theme.dto';

/**
 * Static platform configuration - which design systems and layouts exist, and which pairs
 * are valid. No auth: it carries no tenant data, and both the Client control panel (to
 * populate its own dropdowns) and a future admin surface read the exact same list.
 */
@ApiTags('public')
@Controller('design-registry')
export class DesignRegistryController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'List the available design systems and layouts' })
  @ApiResponse({ status: 200, type: DesignRegistryResponseDto })
  get(): DesignRegistryResponseDto {
    return {
      designSystems: DESIGN_SYSTEMS.map((d) => ({ ...d, layouts: [...d.layouts] })),
      layouts: LAYOUTS.map((l) => ({ ...l })),
    };
  }
}
