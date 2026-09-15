/*
  Warnings:

  - The primary key for the `module` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `parentModule` on the `module` table. All the data in the column will be lost.
  - The primary key for the `modulepermission` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `roles` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `schools` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `city` on the `schools` table. All the data in the column will be lost.
  - You are about to alter the column `record_status` on the `schools` table. The data in that column could be lost. The data in that column will be cast from `Int` to `TinyInt`.
  - The primary key for the `siblings` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `students` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `student_id` on the `students` table. All the data in the column will be lost.
  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `user_id` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `announcement` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `announcementlocation` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `announcementlocation` DROP FOREIGN KEY `announcementLocation_announcement_id_fkey`;

-- DropForeignKey
ALTER TABLE `modulepermission` DROP FOREIGN KEY `modulePermission_module_id_fkey`;

-- DropForeignKey
ALTER TABLE `modulepermission` DROP FOREIGN KEY `modulePermission_role_id_fkey`;

-- DropForeignKey
ALTER TABLE `siblings` DROP FOREIGN KEY `siblings_ibfk_1`;

-- DropForeignKey
ALTER TABLE `students` DROP FOREIGN KEY `students_college_school_id_fkey`;

-- DropForeignKey
ALTER TABLE `students` DROP FOREIGN KEY `students_g12_school_id_fkey`;

-- DropForeignKey
ALTER TABLE `students` DROP FOREIGN KEY `students_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `users` DROP FOREIGN KEY `users_role_id_fkey`;

-- DropIndex
DROP INDEX `modulePermission_module_id_fkey` ON `modulepermission`;

-- DropIndex
DROP INDEX `modulePermission_role_id_fkey` ON `modulepermission`;

-- DropIndex
DROP INDEX `student_id` ON `students`;

-- DropIndex
DROP INDEX `students_college_school_id_fkey` ON `students`;

-- DropIndex
DROP INDEX `students_g12_school_id_fkey` ON `students`;

-- DropIndex
DROP INDEX `user_id` ON `users`;

-- DropIndex
DROP INDEX `users_role_id_fkey` ON `users`;

-- AlterTable
ALTER TABLE `module` DROP PRIMARY KEY,
    DROP COLUMN `parentModule`,
    ADD COLUMN `parent_id` BINARY(16) NULL,
    MODIFY `id` BINARY(16) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `modulepermission` DROP PRIMARY KEY,
    MODIFY `id` BINARY(16) NOT NULL,
    MODIFY `role_id` BINARY(16) NOT NULL,
    MODIFY `module_id` BINARY(16) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `roles` DROP PRIMARY KEY,
    MODIFY `id` BINARY(16) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `schools` DROP PRIMARY KEY,
    DROP COLUMN `city`,
    MODIFY `id` BINARY(16) NOT NULL,
    MODIFY `record_status` BOOLEAN NOT NULL DEFAULT true,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `siblings` DROP PRIMARY KEY,
    MODIFY `id` BINARY(16) NOT NULL,
    MODIFY `student_id` BINARY(16) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `students` DROP PRIMARY KEY,
    DROP COLUMN `student_id`,
    ADD COLUMN `gwa` FLOAT NULL,
    MODIFY `id` BINARY(16) NOT NULL,
    MODIFY `user_id` BINARY(16) NOT NULL,
    MODIFY `college_school_id` BINARY(16) NULL,
    MODIFY `g12_school_id` BINARY(16) NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `users` DROP PRIMARY KEY,
    DROP COLUMN `user_id`,
    ADD COLUMN `profile` VARCHAR(255) NULL,
    ADD COLUMN `username` VARCHAR(255) NOT NULL DEFAULT 'user',
    MODIFY `id` BINARY(16) NOT NULL,
    MODIFY `role_id` BINARY(16) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- DropTable
DROP TABLE `announcement`;

-- DropTable
DROP TABLE `announcementlocation`;

-- CreateTable
CREATE TABLE `announcements` (
    `id` BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID())),
    `title` VARCHAR(255) NOT NULL,
    `caption` VARCHAR(255) NOT NULL,
    `sponsorship_id` BINARY(16) NULL,
    `content` TEXT NOT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `created_by` BINARY(16) NULL,
    `updated_by` BINARY(16) NULL,
    `record_status` BOOLEAN NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `announcementLocations` (
    `id` BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID())),
    `announcement_id` BINARY(16) NOT NULL,
    `citymun_id` INTEGER NOT NULL,

    INDEX `announcement_id`(`announcement_id`),
    UNIQUE INDEX `unique_announcement_citymun`(`announcement_id`, `citymun_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `announcementFiles` (
    `id` BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID())),
    `announcement_id` BINARY(16) NOT NULL,
    `file_name` VARCHAR(191) NOT NULL,
    `path` VARCHAR(191) NOT NULL,
    `mime_type` VARCHAR(191) NOT NULL,

    INDEX `announcement_id`(`announcement_id`),
    UNIQUE INDEX `unique_announcement_file`(`announcement_id`, `file_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fileType` (
    `id` BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID())),
    `name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,
    `created_by` BINARY(16) NULL,
    `updated_by` BINARY(16) NULL,

    UNIQUE INDEX `fileType_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `file` (
    `id` BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID())),
    `file_name` VARCHAR(191) NOT NULL,
    `path` VARCHAR(191) NOT NULL,
    `mime_type` VARCHAR(191) NOT NULL,
    `file_type_id` BINARY(16) NOT NULL,
    `student_id` BINARY(16) NOT NULL,
    `record_status` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,
    `created_by` BINARY(16) NULL,
    `updated_by` BINARY(16) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sponsorships` (
    `id` BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID())),
    `name` VARCHAR(191) NOT NULL,
    `sponsor_id` BINARY(16) NOT NULL,
    `coordinator_id` BINARY(16) NOT NULL,
    `academic_year_id` BINARY(16) NOT NULL,
    `duration_from` DATETIME(3) NOT NULL,
    `duration_to` DATETIME(3) NOT NULL,
    `batch_number` INTEGER NOT NULL,
    `limit` INTEGER NOT NULL,
    `slot` INTEGER NOT NULL,
    `fund_allocation` DECIMAL(65, 30) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `record_status` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` BINARY(16) NOT NULL,
    `updated_by` BINARY(16) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `academicYears` (
    `id` BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID())),
    `academic_year_start` INTEGER NOT NULL,
    `academic_year_end` INTEGER NOT NULL,
    `school_term` INTEGER NOT NULL,
    `date_from` DATETIME(3) NOT NULL,
    `date_to` DATETIME(3) NOT NULL,
    `record_status` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` BINARY(16) NOT NULL,
    `updated_by` BINARY(16) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sponsorshipSchools` (
    `sponsorship_id` BINARY(16) NOT NULL,
    `school_id` BINARY(16) NOT NULL,

    PRIMARY KEY (`sponsorship_id`, `school_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sponsorshipRequirements` (
    `sponsorship_id` BINARY(16) NOT NULL,
    `file_type_id` BINARY(16) NOT NULL,

    PRIMARY KEY (`sponsorship_id`, `file_type_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sponsorshipapplications` (
    `id` BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID())),
    `app_id` VARCHAR(255) NOT NULL,
    `student_id` BINARY(16) NOT NULL,
    `sponsorship_id` BINARY(16) NOT NULL,
    `application_stage` ENUM('POOLING', 'APPLICATION_LIST', 'RANKING_SELECTION', 'FINAS_PROPER') NOT NULL,
    `application_status` ENUM('PENDING_POOLING', 'FOLLOW_UP', 'COMPLETE', 'REJECTED', 'PENDING_APPLICATION_LIST', 'PENDING_RANKING_SELECTION', 'RANKED', 'NOT_QUALIFIED', 'AWARDED') NOT NULL,
    `application_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `remarks` VARCHAR(191) NULL,
    `interview_status` ENUM('PENDING', 'PASSED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `exam_status` ENUM('PENDING', 'PASSED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `record_status` BOOLEAN NOT NULL DEFAULT true,
    `award_number` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` BINARY(16) NOT NULL,
    `updated_by` BINARY(16) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `schedule` (
    `id` BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID())),
    `sponsorship_id` BINARY(16) NOT NULL,
    `batch_no` INTEGER NOT NULL,
    `schedule_type` ENUM('TEST', 'INTERVIEW') NOT NULL,
    `location` VARCHAR(255) NOT NULL,
    `start_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NOT NULL,
    `schedule_quota` INTEGER NOT NULL,
    `record_status` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` BINARY(16) NULL,
    `updated_by` BINARY(16) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `criterionCategory` (
    `id` BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID())),
    `name` VARCHAR(255) NOT NULL,
    `record_status` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` BINARY(16) NULL,
    `updated_by` BINARY(16) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `defaultCategoryCriterion` (
    `id` BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID())),
    `criterion_category_id` BINARY(16) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `record_status` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` BINARY(16) NULL,
    `updated_by` BINARY(16) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sponsorshipCriterion` (
    `id` BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID())),
    `sponsorship_id` BINARY(16) NOT NULL,
    `criterion_category_id` BINARY(16) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `label` VARCHAR(255) NOT NULL,
    `data_source` ENUM('COLUMN', 'CUSTOM_INPUT', 'COMPUTED') NOT NULL,
    `formula_type` ENUM('SUM', 'AVG') NULL,
    `preference` ENUM('MAX', 'MIN') NULL,
    `record_status` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` BINARY(16) NULL,
    `updated_by` BINARY(16) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `criterionRequiredColumn` (
    `id` BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID())),
    `sponsorship_criterion_id` BINARY(16) NOT NULL,
    `table` VARCHAR(255) NOT NULL,
    `column` VARCHAR(255) NOT NULL,
    `record_status` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` BINARY(16) NULL,
    `updated_by` BINARY(16) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sponsorshipCriteriaPairwise` (
    `id` BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID())),
    `sponsorship_criterion_id_a` BINARY(16) NOT NULL,
    `sponsorship_criterion_name_a` VARCHAR(191) NOT NULL,
    `sponsorship_criterion_id_b` BINARY(16) NOT NULL,
    `sponsorship_criterion_name_b` VARCHAR(191) NOT NULL,
    `sponsorship_id` BINARY(16) NOT NULL,
    `value` INTEGER NOT NULL,
    `record_status` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` BINARY(16) NULL,
    `updated_by` BINARY(16) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customInputCriterion` (
    `id` BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID())),
    `sponsorship_criterion_id` BINARY(16) NOT NULL,
    `sponsorship_id` BINARY(16) NOT NULL,
    `student_id` BINARY(16) NOT NULL,
    `value` DOUBLE NOT NULL,
    `record_status` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` BINARY(16) NULL,
    `updated_by` BINARY(16) NULL,

    UNIQUE INDEX `customInputCriterion_student_id_sponsorship_criterion_id_spo_key`(`student_id`, `sponsorship_criterion_id`, `sponsorship_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_reset_tokens` (
    `id` BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID())),
    `user_id` BINARY(16) NOT NULL,
    `token` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `password_reset_tokens_token_key`(`token`),
    INDEX `password_reset_tokens_user_id_idx`(`user_id`),
    INDEX `password_reset_tokens_token_idx`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `faqs` (
    `id` BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID())),
    `question` TEXT NOT NULL,
    `answer` TEXT NOT NULL,
    `category` VARCHAR(100) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `record_status` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` BINARY(16) NULL,
    `updated_by` BINARY(16) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `static_contents` (
    `id` BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID())),
    `content_type` VARCHAR(50) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `record_status` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` BINARY(16) NULL,
    `updated_by` BINARY(16) NULL,

    UNIQUE INDEX `static_contents_content_type_key`(`content_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `resources` (
    `id` BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID())),
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_path` VARCHAR(500) NOT NULL,
    `file_type` VARCHAR(50) NOT NULL,
    `category` VARCHAR(100) NULL,
    `download_count` INTEGER NOT NULL DEFAULT 0,
    `record_status` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` BINARY(16) NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` BINARY(16) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID())),
    `user_id` BINARY(16) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `message` TEXT NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `reference_id` BINARY(16) NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `module` ADD CONSTRAINT `module_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `module`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `modulePermission` ADD CONSTRAINT `modulePermission_module_id_fkey` FOREIGN KEY (`module_id`) REFERENCES `module`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `modulePermission` ADD CONSTRAINT `modulePermission_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `siblings` ADD CONSTRAINT `siblings_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_g12_school_id_fkey` FOREIGN KEY (`g12_school_id`) REFERENCES `schools`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_college_school_id_fkey` FOREIGN KEY (`college_school_id`) REFERENCES `schools`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announcements` ADD CONSTRAINT `announcements_sponsorship_id_fkey` FOREIGN KEY (`sponsorship_id`) REFERENCES `sponsorships`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announcementLocations` ADD CONSTRAINT `announcementLocations_announcement_id_fkey` FOREIGN KEY (`announcement_id`) REFERENCES `announcements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announcementLocations` ADD CONSTRAINT `announcementLocations_citymun_id_fkey` FOREIGN KEY (`citymun_id`) REFERENCES `citymuns`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announcementFiles` ADD CONSTRAINT `announcementFiles_announcement_id_fkey` FOREIGN KEY (`announcement_id`) REFERENCES `announcements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `file` ADD CONSTRAINT `file_file_type_id_fkey` FOREIGN KEY (`file_type_id`) REFERENCES `fileType`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `file` ADD CONSTRAINT `file_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sponsorships` ADD CONSTRAINT `sponsorships_sponsor_id_fkey` FOREIGN KEY (`sponsor_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sponsorships` ADD CONSTRAINT `sponsorships_coordinator_id_fkey` FOREIGN KEY (`coordinator_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sponsorships` ADD CONSTRAINT `sponsorships_academic_year_id_fkey` FOREIGN KEY (`academic_year_id`) REFERENCES `academicYears`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sponsorshipSchools` ADD CONSTRAINT `sponsorshipSchools_sponsorship_id_fkey` FOREIGN KEY (`sponsorship_id`) REFERENCES `sponsorships`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sponsorshipSchools` ADD CONSTRAINT `sponsorshipSchools_school_id_fkey` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sponsorshipRequirements` ADD CONSTRAINT `sponsorshipRequirements_sponsorship_id_fkey` FOREIGN KEY (`sponsorship_id`) REFERENCES `sponsorships`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sponsorshipRequirements` ADD CONSTRAINT `sponsorshipRequirements_file_type_id_fkey` FOREIGN KEY (`file_type_id`) REFERENCES `fileType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sponsorshipapplications` ADD CONSTRAINT `sponsorshipapplications_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sponsorshipapplications` ADD CONSTRAINT `sponsorshipapplications_sponsorship_id_fkey` FOREIGN KEY (`sponsorship_id`) REFERENCES `sponsorships`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedule` ADD CONSTRAINT `schedule_sponsorship_id_fkey` FOREIGN KEY (`sponsorship_id`) REFERENCES `sponsorships`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `defaultCategoryCriterion` ADD CONSTRAINT `defaultCategoryCriterion_criterion_category_id_fkey` FOREIGN KEY (`criterion_category_id`) REFERENCES `criterionCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sponsorshipCriterion` ADD CONSTRAINT `sponsorshipCriterion_sponsorship_id_fkey` FOREIGN KEY (`sponsorship_id`) REFERENCES `sponsorships`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sponsorshipCriterion` ADD CONSTRAINT `sponsorshipCriterion_criterion_category_id_fkey` FOREIGN KEY (`criterion_category_id`) REFERENCES `criterionCategory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `criterionRequiredColumn` ADD CONSTRAINT `criterionRequiredColumn_sponsorship_criterion_id_fkey` FOREIGN KEY (`sponsorship_criterion_id`) REFERENCES `sponsorshipCriterion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sponsorshipCriteriaPairwise` ADD CONSTRAINT `sponsorshipCriteriaPairwise_sponsorship_criterion_id_a_fkey` FOREIGN KEY (`sponsorship_criterion_id_a`) REFERENCES `sponsorshipCriterion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sponsorshipCriteriaPairwise` ADD CONSTRAINT `sponsorshipCriteriaPairwise_sponsorship_criterion_id_b_fkey` FOREIGN KEY (`sponsorship_criterion_id_b`) REFERENCES `sponsorshipCriterion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sponsorshipCriteriaPairwise` ADD CONSTRAINT `sponsorshipCriteriaPairwise_sponsorship_id_fkey` FOREIGN KEY (`sponsorship_id`) REFERENCES `sponsorships`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customInputCriterion` ADD CONSTRAINT `customInputCriterion_sponsorship_criterion_id_fkey` FOREIGN KEY (`sponsorship_criterion_id`) REFERENCES `sponsorshipCriterion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customInputCriterion` ADD CONSTRAINT `customInputCriterion_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
