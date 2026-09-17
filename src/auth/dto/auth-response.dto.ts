import { ApiProperty } from '@nestjs/swagger';

export class AuthUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true, type: String })
  name!: string | null;

  @ApiProperty({ description: 'Id of the profile (tenant) this administrator manages' })
  personId!: string;

  @ApiProperty({ description: 'Public slug of that profile' })
  personSlug!: string;
}

export class LoginResponseDto {
  @ApiProperty({ description: 'JWT bearer token' })
  accessToken!: string;

  @ApiProperty({ description: 'Seconds until the token expires', example: 604800 })
  expiresIn!: number;

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}
