import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response contract for GET /api/v1/public/profile.
 *
 * These shapes mirror the Angular interfaces in src/app/core/models/*.model.ts field for
 * field, so the frontend keeps its existing models and components. In particular, child
 * collections that the frontend types as `string[]` (responsibilities, highlights,
 * technologies, course skills) are flattened to strings here rather than exposed as rows -
 * see docs/MIGRATION-MAPPING.md §6.
 *
 * No Prisma model is ever returned directly, and nothing here carries database ids,
 * timestamps, isPublished flags or any admin metadata.
 */

export class PublicPersonDto {
  @ApiProperty() name!: string;
  @ApiProperty() title!: string;
  @ApiProperty() summary!: string;
  @ApiProperty() location!: string;
  @ApiProperty() yearsOfExperience!: number;
  @ApiProperty({ description: 'Frontend-relative asset path, stored verbatim' })
  avatar!: string;
  @ApiProperty() tagline!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) linkedin?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) birthday?: string | null;
}

export class PublicSocialLinkDto {
  @ApiProperty() platform!: string;
  @ApiProperty() url!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) icon?: string | null;
}

export class PublicContactDto {
  @ApiProperty() email!: string;
  @ApiProperty() phone!: string;
  @ApiProperty() whatsapp!: string;
  @ApiProperty() linkedin!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) location?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) birthday?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) muchskills?: string | null;
  @ApiProperty({ type: [PublicSocialLinkDto] }) socialLinks!: PublicSocialLinkDto[];
}

export class PublicExperienceDto {
  @ApiProperty({ description: 'Original frontend id, e.g. "exp1"' }) id!: string;
  @ApiProperty() company!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) companyFullName?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) companyLogo?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) companyWebsite?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) companyDescription?: string | null;
  @ApiProperty() position!: string;
  @ApiProperty() location!: string;
  @ApiProperty() startDate!: string;
  @ApiProperty({ type: String, nullable: true }) endDate!: string | null;
  @ApiProperty() isCurrent!: boolean;
  @ApiProperty() description!: string;
  @ApiProperty({ type: [String] }) responsibilities!: string[];
  @ApiProperty({ type: [String] }) technologies!: string[];
  @ApiProperty({ type: [String] }) achievements!: string[];
}

export class PublicProjectDto {
  @ApiProperty({ description: 'Original frontend id, e.g. "proj1"' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() description!: string;
  @ApiProperty() role!: string;
  @ApiProperty() startDate!: string;
  @ApiProperty({ type: String, nullable: true }) endDate!: string | null;
  @ApiProperty({ type: [String] }) technologies!: string[];
  @ApiProperty({ type: [String] }) highlights!: string[];
  @ApiPropertyOptional({ type: String, nullable: true }) imageUrl?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) githubUrl?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) liveUrl?: string | null;
  @ApiProperty() isStrategicInitiative!: boolean;
  @ApiProperty({ description: 'Present in source data, absent from the frontend interface' })
  isCurrent!: boolean;
  @ApiPropertyOptional({ type: String, nullable: true }) type?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) company?: string | null;
}

export class PublicAchievementDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty() date!: string;
  @ApiProperty({ enum: ['award', 'certification', 'recognition', 'milestone'] })
  category!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) organization?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) icon?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) articleUrl?: string | null;
}

export class PublicCourseDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() provider!: string;
  @ApiProperty() completionDate!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) level?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) description?: string | null;
  @ApiProperty({ type: [String] }) skills!: string[];
  @ApiPropertyOptional({ type: String, nullable: true }) duration?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) instructor?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) courseUrl?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) certificateUrl?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) startDate?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) grade?: string | null;
}

export class PublicTimelineEventDto {
  @ApiProperty() id!: string;
  @ApiProperty() date!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ type: String, nullable: true }) subtitle!: string | null;
  @ApiProperty() description!: string;
  @ApiProperty({ enum: ['work', 'education', 'achievement', 'project', 'certification'] })
  type!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) icon?: string | null;
}

export class PublicManagementRoleDto {
  @ApiProperty() id!: string;
  @ApiProperty({
    enum: ['high', 'medium', 'low'],
    description:
      'Source data contains "medium", which the current frontend interface does not declare.',
  })
  level!: string;
  @ApiProperty() title!: string;
  @ApiProperty() organization!: string;
  @ApiProperty() startDate!: string;
  @ApiProperty({ type: String, nullable: true }) endDate!: string | null;
  @ApiProperty() isCurrent!: boolean;
  @ApiProperty() description!: string;
  @ApiPropertyOptional({ type: Number, nullable: true }) teamSize?: number | null;
  @ApiProperty({ type: [String] }) keyResponsibilities!: string[];
  @ApiProperty({ type: [String] }) achievements!: string[];
}

export class PublicSkillDto {
  @ApiProperty() name!: string;
  @ApiProperty({ description: '0-9. 0 means unranked and is not the same as level 1.' })
  level!: number;
  @ApiProperty({ description: 'Denormalised category name, matching the frontend Skill model' })
  category!: string;
  @ApiPropertyOptional({ type: Number, nullable: true }) since?: number | null;
  @ApiPropertyOptional({ type: String, nullable: true }) icon?: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) yearsOfExperience?: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) endorsements?: number | null;
}

export class PublicSkillCategoryDto {
  @ApiProperty() category!: string;
  @ApiProperty({ type: [PublicSkillDto] }) skills!: PublicSkillDto[];
}

/** Matches the frontend `SkillData` interface: `{ categories: [...] }`. */
export class PublicSkillDataDto {
  @ApiProperty({ type: [PublicSkillCategoryDto] }) categories!: PublicSkillCategoryDto[];
}

export class PublicTenantDto {
  @ApiProperty({ description: 'Public, human-readable identifier - the one used in URLs' })
  slug!: string;
  @ApiProperty() name!: string;
}

export class PublicThemeDto {
  @ApiProperty() primaryColor!: string;
  @ApiProperty() secondaryColor!: string;
  @ApiProperty() accentColor!: string;
  @ApiProperty() backgroundColor!: string;
  @ApiProperty() textColor!: string;
  @ApiProperty() headingColor!: string;
  @ApiProperty() fontFamily!: string;
  @ApiProperty() borderRadius!: string;
  @ApiProperty() layout!: string;
  @ApiProperty() designSystem!: string;
  @ApiProperty() themeMode!: string;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Optional tenant-authored CSS. The frontend must render this inside a scoped <style> ' +
      'tag rather than evaluate it, so it can change appearance but cannot execute script.',
  })
  customCss?: string | null;
}

export class PublicWebsiteSettingsDto {
  @ApiProperty() websiteTitle!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) description?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) faviconUrl?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) logoUrl?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) seoTitle?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) seoDescription?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) ogImageUrl?: string | null;
}

export class PublicProfileDto {
  @ApiProperty({ type: PublicTenantDto }) tenant!: PublicTenantDto;
  @ApiProperty({ type: PublicPersonDto }) person!: PublicPersonDto;
  @ApiProperty({ type: PublicContactDto, nullable: true }) contact!: PublicContactDto | null;
  @ApiProperty({ type: [PublicExperienceDto] }) experiences!: PublicExperienceDto[];
  @ApiProperty({ type: [PublicProjectDto] }) projects!: PublicProjectDto[];
  @ApiProperty({ type: [PublicAchievementDto] }) achievements!: PublicAchievementDto[];
  @ApiProperty({ type: [PublicCourseDto] }) courses!: PublicCourseDto[];
  @ApiProperty({ type: [PublicTimelineEventDto] }) timelineEvents!: PublicTimelineEventDto[];
  @ApiProperty({ type: [PublicManagementRoleDto] }) managementRoles!: PublicManagementRoleDto[];
  @ApiProperty({ type: PublicSkillDataDto }) skills!: PublicSkillDataDto;
  @ApiProperty({
    type: Object,
    description:
      "sectionKey -> whether it shows publicly, in the client's own display order (see " +
      'GET tenant/sections). A disabled section is also emptied out above - this map is ' +
      'metadata for building nav, not the sole source of truth for what to render.',
    example: { profile: true, experience: true, projects: false },
  })
  sections!: Record<string, boolean>;
  @ApiProperty({ type: PublicThemeDto }) theme!: PublicThemeDto;
  @ApiProperty({ type: PublicWebsiteSettingsDto }) settings!: PublicWebsiteSettingsDto;
}
