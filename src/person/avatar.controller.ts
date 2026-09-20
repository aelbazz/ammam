import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { AvatarService } from './avatar.service';
import { AvatarResponseDto } from './dto/avatar.dto';

// Decorator arguments are evaluated at class-load time, not through DI - read directly from
// process.env here, the same way AUTH_THROTTLE_LIMIT/CONTACT_THROTTLE_LIMIT already do.
const MAX_AVATAR_SIZE_MB = Number(process.env.MAX_AVATAR_SIZE_MB ?? 5);

@ApiTags('person')
@ApiBearerAuth()
@Roles(Role.CLIENT)
@Controller('tenant/profile/avatar')
export class AvatarController {
  constructor(private readonly avatars: AvatarService) {}

  @Get()
  @ApiOperation({ summary: 'Get the current avatar - a client uploaded one, or the default' })
  @ApiResponse({ status: 200, type: AvatarResponseDto })
  findOne(@CurrentUser() user: AuthenticatedUser): Promise<AvatarResponseDto> {
    return this.avatars.findOne(user.tenantId!);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_AVATAR_SIZE_MB * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @ApiOperation({ summary: 'Upload or replace the avatar (JPEG/PNG/WebP only, SVG rejected)' })
  @ApiResponse({ status: 200, type: AvatarResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Unsupported file type, extension mismatch, or too large',
  })
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<AvatarResponseDto> {
    if (!file) throw new BadRequestException('No file uploaded - expected field "file"');
    return this.avatars.upload(user.tenantId!, file);
  }

  @Delete()
  @ApiOperation({ summary: 'Remove the custom avatar and fall back to the default' })
  @ApiResponse({ status: 200, type: AvatarResponseDto })
  remove(@CurrentUser() user: AuthenticatedUser): Promise<AvatarResponseDto> {
    return this.avatars.remove(user.tenantId!);
  }
}
