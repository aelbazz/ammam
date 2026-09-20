export interface StoredFile {
  /** Absolute, publicly-fetchable URL - what gets saved on the owning record. */
  url: string;
  /** Opaque identifier this same implementation can use to delete the file later. Never
   *  assume it's a filesystem path - an S3-backed implementation would use an object key. */
  key: string;
}

export interface UploadInput {
  /** Where the file conceptually lives, e.g. "avatars/<tenantId>". Implementations are free
   *  to fold this into the key however suits their backend. */
  folder: string;
  buffer: Buffer;
  /** Original filename, used only to preserve the extension. */
  originalName: string;
  contentType: string;
}

/**
 * Storage is behind this abstraction so the rest of the app never talks to a filesystem or
 * a specific cloud SDK directly. `LocalStorageService` is the only implementation for now
 * (local dev shouldn't require a paid provider); swapping in an S3-compatible one later is a
 * new class plus one line in StorageModule, not a change anywhere that calls this.
 */
export abstract class StorageService {
  abstract upload(input: UploadInput): Promise<StoredFile>;
  /** No-ops (does not throw) if the key does not exist - callers delete "the old file, if
   *  any" without needing to check existence themselves first. */
  abstract delete(key: string): Promise<void>;
}
