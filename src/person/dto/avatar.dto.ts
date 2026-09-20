import { ApiProperty } from '@nestjs/swagger';
import { AvatarSource } from '@prisma/client';

export class AvatarResponseDto {
  @ApiProperty() url!: string;
  @ApiProperty({ enum: AvatarSource }) source!: AvatarSource;
}
