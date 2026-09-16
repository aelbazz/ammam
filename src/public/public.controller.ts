import { Controller, Get, HttpStatus, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PublicProfileService } from './public.service';
import { PublicProfileDto } from './dto/public-profile.dto';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('public')
@Controller('public')
export class PublicController {
  constructor(private readonly publicProfileService: PublicProfileService) {}

  /**
   * The single endpoint the Angular frontend calls. Replaces the nine separate JSON file
   * requests that ConfigDataService used to make.
   */
  @Public()
  @Get('profile')
  @ApiOperation({
    summary: 'Complete public profile',
    description:
      'Returns the entire public profile in one response: person, contact, experiences ' +
      '(with responsibilities and technologies), projects (with highlights and ' +
      'technologies), achievements, courses, timeline events, management roles and skills. ' +
      'Supports ETag / If-None-Match and Last-Modified / If-Modified-Since.',
  })
  @ApiResponse({ status: 200, type: PublicProfileDto })
  @ApiResponse({ status: 304, description: 'Not modified - the cached copy is still current' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async getProfile(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<Response<PublicProfileDto | undefined>> {
    const [profile, lastModified] = await Promise.all([
      this.publicProfileService.getPublicProfile(),
      this.publicProfileService.getLastModified(),
    ]);

    const etag = this.publicProfileService.computeETag(profile);
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

    if (this.isFresh(request, etag, lastModifiedSeconds)) {
      return response.status(HttpStatus.NOT_MODIFIED).send();
    }

    return response.status(HttpStatus.OK).json(profile);
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
