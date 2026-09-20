-- Tracks the StorageService key behind a CUSTOM avatar, separate from its public URL, so a
-- replacement or removal can delete the old file without parsing it back out of a URL - see
-- StorageService (storage.service.ts) and AvatarController (person/avatar.controller.ts).

-- AlterTable
ALTER TABLE "person" ADD COLUMN "avatar_storage_key" TEXT;
