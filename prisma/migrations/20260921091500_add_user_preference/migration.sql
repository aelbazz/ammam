-- One row per user's Control Portal preference, separate from TenantTheme (the PUBLIC
-- WEBSITE's own theme, client/tenant-owned). Keyed by userId since ADMIN/COORDINATOR - who
-- have no tenantId - are also real authenticated users of this same portal chrome. No row is
-- seeded at signup; PreferencesService lazily upserts on first PATCH.

-- CreateTable
CREATE TABLE "user_preference" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "theme_mode" TEXT NOT NULL DEFAULT 'light',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_preference_user_id_key" ON "user_preference"("user_id");

-- AddForeignKey
ALTER TABLE "user_preference" ADD CONSTRAINT "user_preference_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
