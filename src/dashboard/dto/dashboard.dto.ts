import { ApiProperty } from '@nestjs/swagger';
import { AvatarSource, TenantStatus } from '@prisma/client';

export class DashboardTenantDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: TenantStatus }) status!: TenantStatus;
}

export class DashboardPersonDto {
  @ApiProperty() name!: string;
  @ApiProperty() title!: string;
  @ApiProperty() avatar!: string;
  @ApiProperty({ enum: AvatarSource }) avatarSource!: AvatarSource;
}

export class DashboardPublicSiteDto {
  @ApiProperty() slug!: string;
  @ApiProperty({
    description:
      'Absolute URL, built from FRONTEND_PUBLIC_URL - never construct this in the frontend',
  })
  url!: string;
  @ApiProperty() isPublished!: boolean;
}

export class DashboardAppearanceDto {
  @ApiProperty() designSystem!: string;
  @ApiProperty() layout!: string;
  @ApiProperty() primaryColor!: string;
}

export class DashboardSectionDto {
  @ApiProperty() sectionKey!: string;
  @ApiProperty() label!: string;
  @ApiProperty() enabled!: boolean;
  @ApiProperty() itemCount!: number;
}

export class DashboardStatisticsDto {
  @ApiProperty() experience!: number;
  @ApiProperty() projects!: number;
  @ApiProperty() skills!: number;
  @ApiProperty() achievements!: number;
  @ApiProperty() courses!: number;
  @ApiProperty() timeline!: number;
  @ApiProperty() management!: number;
}

export class DashboardResponseDto {
  @ApiProperty({ type: DashboardTenantDto }) tenant!: DashboardTenantDto;
  @ApiProperty({ type: DashboardPersonDto }) person!: DashboardPersonDto;
  @ApiProperty({ type: DashboardPublicSiteDto }) publicSite!: DashboardPublicSiteDto;
  @ApiProperty({ type: DashboardAppearanceDto }) appearance!: DashboardAppearanceDto;
  @ApiProperty({ type: [DashboardSectionDto] }) sections!: DashboardSectionDto[];
  @ApiProperty({ type: DashboardStatisticsDto }) statistics!: DashboardStatisticsDto;
}
