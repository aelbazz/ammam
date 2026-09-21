import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Query,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PublicProfileService } from './public.service';
import { PublicProfileDto } from './dto/public-profile.dto';
import { Public } from '../common/decorators/public.decorator';
import { CvVersionService } from '../cv/cv-version.service';
import { CvExportService } from '../cv/cv-export.service';
import { CvDownloadQueryDto } from '../cv/dto/cv-download-query.dto';

@ApiTags('public')
@Controller('public')
export class PublicController {
  constructor(
    private readonly publicProfileService: PublicProfileService,
    private readonly cvVersions: CvVersionService,
    private readonly cvExport: CvExportService,
  ) {}

  /**
   * The single endpoint the Angular frontend calls for a tenant's public site. Replaces
   * the nine separate JSON file requests the original static frontend used to make.
   *
   * Never trusts a UUID: the tenant is resolved purely from `tenantSlug`, and a suspended,
   * archived, or subscription-inactive tenant returns the same 404 as a slug that was never
   * registered - see TenantAccessService and docs/SAAS-ARCHITECTURE.md "Public API".
   */
  @Public()
  @Get('tenants/:tenantSlug/profile')
  @ApiOperation({
    summary: "Complete public profile for one tenant, addressed by that tenant's slug",
    description:
      'Returns tenant, person, contact, experiences (with responsibilities and ' +
      'technologies), projects (with highlights and technologies), achievements, courses, ' +
      'timeline events, management roles, skills, theme and website settings. Supports ' +
      'ETag / If-None-Match and Last-Modified / If-Modified-Since. A retired slug (one the ' +
      "tenant has since changed) still resolves, via TenantSlugHistory; the response's " +
      '`X-Tenant-Slug-Current` header carries the current slug when that happens.',
  })
  @ApiParam({ name: 'tenantSlug', example: 'albaz' })
  @ApiResponse({ status: 200, type: PublicProfileDto })
  @ApiResponse({ status: 304, description: 'Not modified' })
  @ApiResponse({ status: 404, description: 'No accessible profile at that slug' })
  async getProfileBySlug(
    @Param('tenantSlug') tenantSlug: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<Response<PublicProfileDto | undefined>> {
    const resolved = await this.publicProfileService.resolveBySlug(tenantSlug);
    const lastModified = await this.publicProfileService.getLastModified(
      resolved.tenantId,
      resolved.personId,
    );

    const etag = this.publicProfileService.computeETag(resolved.profile);
    // Last-Modified has one-second resolution, so it is truncated before comparison to
    // avoid a sub-second difference producing a spurious 200.
    const lastModifiedSeconds = Math.floor(lastModified.getTime() / 1000) * 1000;

    // Set explicitly rather than with @Header(): injecting @Res() hands the response to
    // this method, and Nest skips its own header decorators when it is not managing it.
    //
    // no-cache means "store it, but revalidate before reuse" - NOT "do not cache". With a
    // strong ETag that revalidation costs a 304 with an empty body, so repeat loads stay
    // cheap while an admin edit shows up immediately. A max-age here would leave the public
    // site serving stale content for the length of the window after every edit.
    response.setHeader('Cache-Control', 'public, no-cache');
    response.setHeader('ETag', etag);
    response.setHeader('Last-Modified', new Date(lastModifiedSeconds).toUTCString());
    if (resolved.redirectedFromSlug) {
      response.setHeader('X-Tenant-Slug-Current', resolved.profile.tenant.slug);
    }

    if (this.isFresh(request, etag, lastModifiedSeconds)) {
      return response.status(HttpStatus.NOT_MODIFIED).send();
    }

    return response.status(HttpStatus.OK).json(resolved.profile);
  }

  /**
   * The tenant's default CV, as an anonymous download - the "Download CV" button on the
   * public profile page. Distinct from `tenant/cv/versions/:id/download` (authenticated,
   * any of the client's own saved versions): a site visitor has no JWT, and always wants
   * "the" CV, not a specific saved configuration - see CvVersion.isDefault.
   *
   * Reuses resolveBySlug() so a suspended/unpublished/nonexistent tenant 404s exactly like
   * the profile endpoint above - never a different error that would leak which case applies.
   */
  @Public()
  @Get('tenants/:tenantSlug/cv')
  @ApiOperation({ summary: "Download a tenant's default CV as PDF or DOCX" })
  @ApiParam({ name: 'tenantSlug', example: 'albaz' })
  @ApiResponse({ status: 200, description: 'The generated file' })
  @ApiResponse({ status: 404, description: 'No accessible profile at that slug' })
  async downloadCv(
    @Param('tenantSlug') tenantSlug: string,
    @Query() query: CvDownloadQueryDto,
  ): Promise<StreamableFile> {
    const resolved = await this.publicProfileService.resolveBySlug(tenantSlug);
    const defaultVersion = await this.cvVersions.findDefault(resolved.personId);
    const { buffer, filename, mimeType } = await this.cvExport.generate(
      resolved.personId,
      defaultVersion.id,
      query.format,
    );
    return new StreamableFile(buffer, {
      type: mimeType,
      disposition: `attachment; filename="${filename}"`,
    });
  }

  /**
   * If-None-Match wins outright when present, per RFC 9110 §13.1.3 - a validator mismatch
   * on the entity tag must not be overridden by a date comparison.
   */
  private isFresh(request: Request, etag: string, lastModifiedMs: number): boolean {
    const ifNoneMatch = request.headers['if-none-match'];
    if (ifNoneMatch) {
      return ifNoneMatch
        .split(',')
        .map((t) => t.trim())
        .some((t) => t === etag || t === `W/${etag}` || t === '*');
    }

    const ifModifiedSince = request.headers['if-modified-since'];
    if (ifModifiedSince) {
      const since = Date.parse(ifModifiedSince);
      return !Number.isNaN(since) && lastModifiedMs <= since;
    }

    return false;
  }
}
