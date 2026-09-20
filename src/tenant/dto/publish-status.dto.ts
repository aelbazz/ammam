import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdatePublishStatusDto {
  @ApiProperty({ description: 'Whether the public profile is live' })
  @IsBoolean()
  isPublished!: boolean;
}

export class PublishStatusResponseDto {
  @ApiProperty() isPublished!: boolean;
}
