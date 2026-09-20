import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { dirname, extname, join } from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService, StoredFile, UploadInput } from './storage.service';

const UPLOADS_ROOT = join(process.cwd(), 'public', 'uploads');

/**
 * Writes to the local filesystem, under the same `public/` directory main.ts serves
 * statically. `key` is always forward-slash-separated (it's a logical identifier this class
 * hands back to itself later, and eventually gets embedded in a URL) - `path.join` is used
 * only where an actual OS filesystem path is needed, so this behaves the same on Windows.
 * `public/uploads/` is gitignored - these are runtime files, never committed.
 */
@Injectable()
export class LocalStorageService extends StorageService {
  private readonly logger = new Logger(LocalStorageService.name);

  constructor(private readonly config: ConfigService) {
    super();
  }

  async upload(input: UploadInput): Promise<StoredFile> {
    const extension = extname(input.originalName) || '';
    const key = `${input.folder}/${randomUUID()}${extension}`;
    const absolutePath = this.toFilesystemPath(key);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.buffer);

    return { url: this.buildUrl(key), key };
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.toFilesystemPath(key));
    } catch {
      // Already gone, or never existed - deleting "the old file, if any" is not an error.
      this.logger.debug(`Nothing to delete at key "${key}"`);
    }
  }

  private toFilesystemPath(key: string): string {
    return join(UPLOADS_ROOT, ...key.split('/'));
  }

  private buildUrl(key: string): string {
    const base =
      this.config.get<string>('API_PUBLIC_URL') ??
      `http://localhost:${this.config.get('PORT') ?? 3000}`;
    return `${base}/uploads/${key}`;
  }
}
