import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class AuthUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true, type: String })
  name!: string | null;

  @ApiProperty({ enum: Role })
  role!: Role;

  @ApiProperty({ nullable: true, type: String, description: 'Set only for role CLIENT' })
  tenantId!: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Set only for role CLIENT' })
  tenantSlug!: string | null;
}

export class LoginResponseDto {
  @ApiProperty({ description: 'JWT bearer token' })
  accessToken!: string;

  @ApiProperty({ description: 'Seconds until the token expires', example: 604800 })
  expiresIn!: number;

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}
