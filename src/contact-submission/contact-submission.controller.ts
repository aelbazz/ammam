import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ContactSubmissionStatus, Role } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { ContactSubmissionService } from './contact-submission.service';
import {
  ContactSubmissionResponseDto,
  CreateContactSubmissionDto,
  UpdateContactSubmissionStatusDto,
} from './dto/contact-submission.dto';

@ApiTags('contact-submissions')
@Controller('contact-submissions')
export class ContactSubmissionController {
  constructor(private readonly service: ContactSubmissionService) {}

  @Public()
  // Overrides the single 'default' throttler for this route only, same pattern as
  // AuthController.login - see app.module.ts for why a second named throttler is never used.
  @Throttle({ default: { limit: Number(process.env.CONTACT_THROTTLE_LIMIT ?? 5), ttl: 60_000 } })
  @Post()
  @ApiOperation({ summary: 'Submit the Portfolio marketing site contact form' })
  @ApiResponse({ status: 201, type: ContactSubmissionResponseDto })
  submit(
    @Body() dto: CreateContactSubmissionDto,
    @Req() req: Request,
  ): Promise<ContactSubmissionResponseDto> {
    return this.service.submit(dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Roles(Role.ADMIN, Role.COORDINATOR)
  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: 'List contact submissions' })
  @ApiResponse({ status: 200, type: [ContactSubmissionResponseDto] })
  findAll(
    @Query('status') status?: ContactSubmissionStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Roles(Role.ADMIN, Role.COORDINATOR)
  @ApiBearerAuth()
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Change a submission's status" })
  @ApiResponse({ status: 200, type: ContactSubmissionResponseDto })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateContactSubmissionStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ContactSubmissionResponseDto> {
    return this.service.updateStatus(id, dto.status, user);
  }
}
