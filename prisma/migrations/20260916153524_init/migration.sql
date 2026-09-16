-- CreateEnum
CREATE TYPE "achievement_category" AS ENUM ('award', 'certification', 'recognition', 'milestone');

-- CreateEnum
CREATE TYPE "timeline_event_type" AS ENUM ('work', 'education', 'achievement', 'project', 'certification');

-- CreateEnum
CREATE TYPE "management_level" AS ENUM ('high', 'medium', 'low');

-- CreateTable
CREATE TABLE "person" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "years_of_experience" INTEGER NOT NULL,
    "avatar" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "linkedin" TEXT,
    "birthday" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "linkedin" TEXT NOT NULL,
    "location" TEXT,
    "birthday" TEXT,
    "muchskills" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_social_link" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "icon" TEXT,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "contact_social_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experience" (
    "id" TEXT NOT NULL,
    "legacy_id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "company_full_name" TEXT,
    "company_logo" TEXT,
    "company_website" TEXT,
    "company_description" TEXT,
    "position" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "start_date" TEXT NOT NULL,
    "end_date" TEXT,
    "is_current" BOOLEAN NOT NULL,
    "description" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "experience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exp_responsibility" (
    "id" TEXT NOT NULL,
    "experience_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "exp_responsibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exp_achievement" (
    "id" TEXT NOT NULL,
    "experience_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "exp_achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exp_technology" (
    "experience_id" TEXT NOT NULL,
    "technology_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "exp_technology_pkey" PRIMARY KEY ("experience_id","technology_id")
);

-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL,
    "legacy_id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "start_date" TEXT NOT NULL,
    "end_date" TEXT,
    "type" TEXT,
    "company" TEXT,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "is_strategic_initiative" BOOLEAN NOT NULL DEFAULT false,
    "image_url" TEXT,
    "github_url" TEXT,
    "live_url" TEXT,
    "sort_order" INTEGER NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proj_highlight" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "proj_highlight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proj_technology" (
    "project_id" TEXT NOT NULL,
    "technology_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "proj_technology_pkey" PRIMARY KEY ("project_id","technology_id")
);

-- CreateTable
CREATE TABLE "technology" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technology_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievement" (
    "id" TEXT NOT NULL,
    "legacy_id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "category" "achievement_category" NOT NULL,
    "organization" TEXT,
    "icon" TEXT,
    "article_url" TEXT,
    "sort_order" INTEGER NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course" (
    "id" TEXT NOT NULL,
    "legacy_id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "completion_date" TEXT NOT NULL,
    "level" TEXT,
    "description" TEXT,
    "duration" TEXT,
    "instructor" TEXT,
    "course_url" TEXT,
    "certificate_url" TEXT,
    "start_date" TEXT,
    "grade" TEXT,
    "sort_order" INTEGER NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_skill" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "course_skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeline_event" (
    "id" TEXT NOT NULL,
    "legacy_id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT NOT NULL,
    "type" "timeline_event_type" NOT NULL,
    "icon" TEXT,
    "sort_order" INTEGER NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timeline_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mgmt_role" (
    "id" TEXT NOT NULL,
    "legacy_id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "level" "management_level" NOT NULL,
    "title" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "start_date" TEXT NOT NULL,
    "end_date" TEXT,
    "is_current" BOOLEAN NOT NULL,
    "description" TEXT NOT NULL,
    "team_size" INTEGER,
    "sort_order" INTEGER NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mgmt_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mgmt_responsibility" (
    "id" TEXT NOT NULL,
    "mgmt_role_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "mgmt_responsibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mgmt_achievement" (
    "id" TEXT NOT NULL,
    "mgmt_role_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "mgmt_achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_category" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "since" INTEGER,
    "icon" TEXT,
    "years_of_experience" INTEGER,
    "endorsements" INTEGER,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_user_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "person_slug_key" ON "person"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "contact_person_id_key" ON "contact"("person_id");

-- CreateIndex
CREATE INDEX "contact_social_link_contact_id_sort_order_idx" ON "contact_social_link"("contact_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "experience_legacy_id_key" ON "experience"("legacy_id");

-- CreateIndex
CREATE INDEX "experience_person_id_sort_order_idx" ON "experience"("person_id", "sort_order");

-- CreateIndex
CREATE INDEX "exp_responsibility_experience_id_sort_order_idx" ON "exp_responsibility"("experience_id", "sort_order");

-- CreateIndex
CREATE INDEX "exp_achievement_experience_id_sort_order_idx" ON "exp_achievement"("experience_id", "sort_order");

-- CreateIndex
CREATE INDEX "exp_technology_experience_id_sort_order_idx" ON "exp_technology"("experience_id", "sort_order");

-- CreateIndex
CREATE INDEX "exp_technology_technology_id_idx" ON "exp_technology"("technology_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_legacy_id_key" ON "project"("legacy_id");

-- CreateIndex
CREATE INDEX "project_person_id_sort_order_idx" ON "project"("person_id", "sort_order");

-- CreateIndex
CREATE INDEX "proj_highlight_project_id_sort_order_idx" ON "proj_highlight"("project_id", "sort_order");

-- CreateIndex
CREATE INDEX "proj_technology_project_id_sort_order_idx" ON "proj_technology"("project_id", "sort_order");

-- CreateIndex
CREATE INDEX "proj_technology_technology_id_idx" ON "proj_technology"("technology_id");

-- CreateIndex
CREATE UNIQUE INDEX "technology_name_key" ON "technology"("name");

-- CreateIndex
CREATE UNIQUE INDEX "technology_slug_key" ON "technology"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "achievement_legacy_id_key" ON "achievement"("legacy_id");

-- CreateIndex
CREATE INDEX "achievement_person_id_sort_order_idx" ON "achievement"("person_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "course_legacy_id_key" ON "course"("legacy_id");

-- CreateIndex
CREATE INDEX "course_person_id_sort_order_idx" ON "course"("person_id", "sort_order");

-- CreateIndex
CREATE INDEX "course_skill_course_id_sort_order_idx" ON "course_skill"("course_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "timeline_event_legacy_id_key" ON "timeline_event"("legacy_id");

-- CreateIndex
CREATE INDEX "timeline_event_person_id_sort_order_idx" ON "timeline_event"("person_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "mgmt_role_legacy_id_key" ON "mgmt_role"("legacy_id");

-- CreateIndex
CREATE INDEX "mgmt_role_person_id_sort_order_idx" ON "mgmt_role"("person_id", "sort_order");

-- CreateIndex
CREATE INDEX "mgmt_responsibility_mgmt_role_id_sort_order_idx" ON "mgmt_responsibility"("mgmt_role_id", "sort_order");

-- CreateIndex
CREATE INDEX "mgmt_achievement_mgmt_role_id_sort_order_idx" ON "mgmt_achievement"("mgmt_role_id", "sort_order");

-- CreateIndex
CREATE INDEX "skill_category_person_id_sort_order_idx" ON "skill_category"("person_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "skill_category_person_id_name_key" ON "skill_category"("person_id", "name");

-- CreateIndex
CREATE INDEX "skill_category_id_sort_order_idx" ON "skill"("category_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "skill_category_id_name_key" ON "skill"("category_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "admin_user_email_key" ON "admin_user"("email");

-- AddForeignKey
ALTER TABLE "contact" ADD CONSTRAINT "contact_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_social_link" ADD CONSTRAINT "contact_social_link_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experience" ADD CONSTRAINT "experience_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp_responsibility" ADD CONSTRAINT "exp_responsibility_experience_id_fkey" FOREIGN KEY ("experience_id") REFERENCES "experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp_achievement" ADD CONSTRAINT "exp_achievement_experience_id_fkey" FOREIGN KEY ("experience_id") REFERENCES "experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp_technology" ADD CONSTRAINT "exp_technology_experience_id_fkey" FOREIGN KEY ("experience_id") REFERENCES "experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exp_technology" ADD CONSTRAINT "exp_technology_technology_id_fkey" FOREIGN KEY ("technology_id") REFERENCES "technology"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proj_highlight" ADD CONSTRAINT "proj_highlight_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proj_technology" ADD CONSTRAINT "proj_technology_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proj_technology" ADD CONSTRAINT "proj_technology_technology_id_fkey" FOREIGN KEY ("technology_id") REFERENCES "technology"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement" ADD CONSTRAINT "achievement_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course" ADD CONSTRAINT "course_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_skill" ADD CONSTRAINT "course_skill_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_event" ADD CONSTRAINT "timeline_event_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mgmt_role" ADD CONSTRAINT "mgmt_role_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mgmt_responsibility" ADD CONSTRAINT "mgmt_responsibility_mgmt_role_id_fkey" FOREIGN KEY ("mgmt_role_id") REFERENCES "mgmt_role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mgmt_achievement" ADD CONSTRAINT "mgmt_achievement_mgmt_role_id_fkey" FOREIGN KEY ("mgmt_role_id") REFERENCES "mgmt_role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_category" ADD CONSTRAINT "skill_category_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill" ADD CONSTRAINT "skill_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "skill_category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
