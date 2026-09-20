import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AvatarSource } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { defaultAvatarUrl } from '../storage/default-avatar.util';
import { AvatarResponseDto } from './dto/avatar.dto';

/** Untrusted input: only these are accepted. SVG is deliberately excluded - it can carry
 *  active content (scripts, external references), unlike a raster image. The built-in
 *  default avatar is the only SVG this system ever serves, and it is never client-supplied. */
const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MIME_TO_EXTENSIONS: Readonly<Record<string, readonly string[]>> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
};

@Injectable()
export class AvatarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  private get defaultAvatarUrl(): string {
    return defaultAvatarUrl(this.config);
  }

  async findOne(tenantId: string): Promise<AvatarResponseDto> {
    const person = await this.getPersonOrThrow(tenantId);
    return { url: person.avatar, source: person.avatarSource };
  }

  async upload(
    tenantId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
  ): Promise<AvatarResponseDto> {
    const person = await this.getPersonOrThrow(tenantId);

    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type "${file.mimetype}". Only JPEG, PNG and WebP images are accepted.`,
      );
    }

    const extension = this.extractExtension(file.originalname);
    if (!MIME_TO_EXTENSIONS[file.mimetype].includes(extension)) {
      throw new BadRequestException('File extension does not match its content type');
    }

    // Upload the new file before touching the old one - a failed upload must never leave
    // the profile without a usable avatar.
    const stored = await this.storage.upload({
      folder: `avatars/${tenantId}`,
      buffer: file.buffer,
      originalName: file.originalname,
      contentType: file.mimetype,
    });

    const previousKey =
      person.avatarSource === AvatarSource.CUSTOM ? person.avatarStorageKey : null;

    await this.prisma.person.update({
      where: { id: person.id },
      data: {
        avatar: stored.url,
        avatarSource: AvatarSource.CUSTOM,
        avatarStorageKey: stored.key,
        avatarUpdatedAt: new Date(),
      },
    });

    if (previousKey) {
      await this.storage.delete(previousKey);
    }

    return { url: stored.url, source: AvatarSource.CUSTOM };
  }

  async remove(tenantId: string): Promise<AvatarResponseDto> {
    const person = await this.getPersonOrThrow(tenantId);

    if (person.avatarSource === AvatarSource.CUSTOM && person.avatarStorageKey) {
      await this.storage.delete(person.avatarStorageKey);
    }

    await this.prisma.person.update({
      where: { id: person.id },
      data: {
        avatar: this.defaultAvatarUrl,
        avatarSource: AvatarSource.DEFAULT,
        avatarStorageKey: null,
        avatarUpdatedAt: new Date(),
      },
    });

    return { url: this.defaultAvatarUrl, source: AvatarSource.DEFAULT };
  }

  private async getPersonOrThrow(tenantId: string) {
    const person = await this.prisma.person.findUnique({ where: { tenantId } });
    if (!person) throw new NotFoundException('Profile not found');
    return person;
  }

  private extractExtension(filename: string): string {
    const match = /\.[^.]+$/.exec(filename);
    return match ? match[0].toLowerCase() : '';
  }
}
