/*
  Warnings:

  - You are about to drop the column `recordStatus` on the `roles` table. All the data in the column will be lost.
  - You are about to drop the column `recordStatus` on the `siblings` table. All the data in the column will be lost.
  - You are about to drop the column `academic_strand` on the `students` table. All the data in the column will be lost.
  - You are about to drop the column `application_form` on the `students` table. All the data in the column will be lost.
  - You are about to drop the column `award_honor` on the `students` table. All the data in the column will be lost.
  - You are about to drop the column `current_address` on the `students` table. All the data in the column will be lost.
  - You are about to drop the column `current_award_honor` on the `students` table. All the data in the column will be lost.
  - You are about to drop the column `current_organization` on the `students` table. All the data in the column will be lost.
  - You are about to drop the column `current_program_name` on the `students` table. All the data in the column will be lost.
  - You are about to drop the column `current_school_address` on the `students` table. All the data in the column will be lost.
  - You are about to drop the column `current_school_name` on the `students` table. All the data in the column will be lost.
  - You are about to drop the column `current_school_type` on the `students` table. All the data in the column will be lost.
  - You are about to drop the column `current_year_level` on the `students` table. All the data in the column will be lost.
  - You are about to drop the column `organization` on the `students` table. All the data in the column will be lost.
  - You are about to drop the column `permanent_address` on the `students` table. All the data in the column will be lost.
  - You are about to drop the column `program_name` on the `students` table. All the data in the column will be lost.
  - You are about to drop the column `recordStatus` on the `students` table. All the data in the column will be lost.
  - You are about to drop the column `school_address` on the `students` table. All the data in the column will be lost.
  - You are about to drop the column `school_name` on the `students` table. All the data in the column will be lost.
  - You are about to drop the column `school_type` on the `students` table. All the data in the column will be lost.
  - You are about to drop the column `year_of_graduation` on the `students` table. All the data in the column will be lost.
  - You are about to drop the column `recordStatus` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `permission_role` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `permissions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `role_user` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `staff` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `role_id` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `permission_role` DROP FOREIGN KEY `permission_role_ibfk_1`;

-- DropForeignKey
ALTER TABLE `permission_role` DROP FOREIGN KEY `permission_role_ibfk_2`;

-- DropForeignKey
ALTER TABLE `role_user` DROP FOREIGN KEY `role_user_ibfk_1`;

-- DropForeignKey
ALTER TABLE `role_user` DROP FOREIGN KEY `role_user_ibfk_2`;

-- DropForeignKey
ALTER TABLE `staff` DROP FOREIGN KEY `staff_ibfk_1`;

-- DropForeignKey
ALTER TABLE `students` DROP FOREIGN KEY `students_ibfk_1`;

-- AlterTable
ALTER TABLE `roles` DROP COLUMN `recordStatus`,
    ADD COLUMN `record_status` BOOLEAN NULL DEFAULT true;

-- AlterTable
ALTER TABLE `siblings` DROP COLUMN `recordStatus`,
    ADD COLUMN `record_status` BOOLEAN NULL DEFAULT true;

-- AlterTable
ALTER TABLE `students` DROP COLUMN `academic_strand`,
    DROP COLUMN `application_form`,
    DROP COLUMN `award_honor`,
    DROP COLUMN `current_address`,
    DROP COLUMN `current_award_honor`,
    DROP COLUMN `current_organization`,
    DROP COLUMN `current_program_name`,
    DROP COLUMN `current_school_address`,
    DROP COLUMN `current_school_name`,
    DROP COLUMN `current_school_type`,
    DROP COLUMN `current_year_level`,
    DROP COLUMN `organization`,
    DROP COLUMN `permanent_address`,
    DROP COLUMN `program_name`,
    DROP COLUMN `recordStatus`,
    DROP COLUMN `school_address`,
    DROP COLUMN `school_name`,
    DROP COLUMN `school_type`,
    DROP COLUMN `year_of_graduation`,
    ADD COLUMN `college_award_honor` VARCHAR(255) NULL,
    ADD COLUMN `college_organization` VARCHAR(255) NULL,
    ADD COLUMN `college_program_name` VARCHAR(255) NULL,
    ADD COLUMN `college_school_id` INTEGER NULL,
    ADD COLUMN `college_year_level` INTEGER NULL,
    ADD COLUMN `current_brg_id` INTEGER NULL,
    ADD COLUMN `current_citymun_id` INTEGER NULL,
    ADD COLUMN `current_country` VARCHAR(255) NULL DEFAULT 'Philippines',
    ADD COLUMN `current_province_id` INTEGER NULL,
    ADD COLUMN `current_region_id` INTEGER NULL,
    ADD COLUMN `current_street` VARCHAR(255) NULL,
    ADD COLUMN `current_zip_code` INTEGER NULL,
    ADD COLUMN `g12_academic_strand` VARCHAR(255) NULL,
    ADD COLUMN `g12_award_honor` VARCHAR(255) NULL,
    ADD COLUMN `g12_organization` VARCHAR(255) NULL,
    ADD COLUMN `g12_program_name` VARCHAR(255) NULL,
    ADD COLUMN `g12_school_id` INTEGER NULL,
    ADD COLUMN `g12_year_of_graduation` INTEGER NULL,
    ADD COLUMN `permanent_brg_id` INTEGER NULL,
    ADD COLUMN `permanent_citymun_id` INTEGER NULL,
    ADD COLUMN `permanent_country` VARCHAR(255) NULL DEFAULT 'Philippines',
    ADD COLUMN `permanent_province_id` INTEGER NULL,
    ADD COLUMN `permanent_region_id` INTEGER NULL,
    ADD COLUMN `permanent_street` VARCHAR(255) NULL,
    ADD COLUMN `permanent_zip_code` INTEGER NULL,
    ADD COLUMN `record_status` BOOLEAN NULL DEFAULT true,
    MODIFY `sex` VARCHAR(10) NULL,
    MODIFY `place_of_birth` VARCHAR(255) NULL,
    MODIFY `birthdate` DATE NULL,
    MODIFY `mobile_number` VARCHAR(15) NULL,
    MODIFY `is_solo_parent` BOOLEAN NULL,
    MODIFY `is_child_of_solo_parent` BOOLEAN NULL,
    MODIFY `is_indigenous_people` BOOLEAN NULL,
    MODIFY `is_sped` BOOLEAN NULL,
    MODIFY `is_pwd` BOOLEAN NULL,
    MODIFY `emergency_contact_name` VARCHAR(255) NULL,
    MODIFY `emergency_contact_number` VARCHAR(15) NULL,
    MODIFY `father_last_name` VARCHAR(255) NULL,
    MODIFY `father_first_name` VARCHAR(255) NULL,
    MODIFY `father_occupation` VARCHAR(255) NULL,
    MODIFY `father_mobile_number` VARCHAR(15) NULL,
    MODIFY `mother_maiden_last_name` VARCHAR(255) NULL,
    MODIFY `mother_maiden_first_name` VARCHAR(255) NULL,
    MODIFY `mother_occupation` VARCHAR(255) NULL,
    MODIFY `mother_mobile_number` VARCHAR(15) NULL,
    MODIFY `guardian_last_name` VARCHAR(255) NULL,
    MODIFY `guardian_first_name` VARCHAR(255) NULL,
    MODIFY `guardian_occupation` VARCHAR(255) NULL,
    MODIFY `guardian_mobile_number` VARCHAR(15) NULL,
    MODIFY `emergency_contact_name2` VARCHAR(255) NULL,
    MODIFY `emergency_contact_number2` VARCHAR(15) NULL,
    MODIFY `email` VARCHAR(255) NULL;

-- AlterTable
ALTER TABLE `users` DROP COLUMN `recordStatus`,
    ADD COLUMN `record_status` BOOLEAN NULL DEFAULT true,
    ADD COLUMN `role_id` INTEGER NOT NULL;

-- DropTable
DROP TABLE `permission_role`;

-- DropTable
DROP TABLE `permissions`;

-- DropTable
DROP TABLE `role_user`;

-- DropTable
DROP TABLE `staff`;

-- CreateTable
CREATE TABLE `module` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `parentModule` INTEGER NULL,
    `sorter` INTEGER NOT NULL,
    `record_status` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `modulePermission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `role_id` INTEGER NOT NULL,
    `module_id` INTEGER NOT NULL,
    `show` BOOLEAN NOT NULL DEFAULT false,
    `edit` BOOLEAN NOT NULL DEFAULT false,
    `save` BOOLEAN NOT NULL DEFAULT false,
    `delete` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `announcement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(255) NOT NULL,
    `content` TEXT NOT NULL,
    `target_municipality` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `created_by` BINARY(16) NULL,
    `updated_by` BINARY(16) NULL,
    `record_status` BOOLEAN NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `announcementLocation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `announcement_id` INTEGER NOT NULL,
    `municipality` VARCHAR(255) NOT NULL,

    INDEX `announcement_id`(`announcement_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `regions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `psgc_code` VARCHAR(191) NULL,
    `reg_desc` VARCHAR(191) NULL,
    `reg_code` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `provinces` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `psgc_code` VARCHAR(191) NULL,
    `prov_desc` VARCHAR(191) NULL,
    `reg_code` VARCHAR(191) NULL,
    `prov_code` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `citymuns` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `psgc_code` VARCHAR(191) NULL,
    `citymun_desc` VARCHAR(191) NULL,
    `reg_desc` VARCHAR(191) NULL,
    `prov_code` VARCHAR(191) NULL,
    `citymun_code` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `barangays` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `brgy_code` VARCHAR(191) NULL,
    `brgy_desc` VARCHAR(191) NULL,
    `reg_code` VARCHAR(191) NULL,
    `prov_code` VARCHAR(191) NULL,
    `citymun_code` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `schools` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `province_id` INTEGER NOT NULL,
    `citymun_id` INTEGER NOT NULL,
    `brgy_id` INTEGER NOT NULL,
    `city` VARCHAR(191) NOT NULL,
    `school_name` VARCHAR(191) NOT NULL,
    `school_type` VARCHAR(191) NOT NULL,
    `record_status` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NULL,
    `created_by` BINARY(16) NULL,
    `updated_by` BINARY(16) NULL,

    INDEX `schools_province_id_idx`(`province_id`),
    INDEX `schools_citymun_id_idx`(`citymun_id`),
    INDEX `schools_brgy_id_idx`(`brgy_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `modulePermission` ADD CONSTRAINT `modulePermission_module_id_fkey` FOREIGN KEY (`module_id`) REFERENCES `module`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `modulePermission` ADD CONSTRAINT `modulePermission_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_permanent_brg_id_fkey` FOREIGN KEY (`permanent_brg_id`) REFERENCES `barangays`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_permanent_citymun_id_fkey` FOREIGN KEY (`permanent_citymun_id`) REFERENCES `citymuns`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_permanent_province_id_fkey` FOREIGN KEY (`permanent_province_id`) REFERENCES `provinces`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_permanent_region_id_fkey` FOREIGN KEY (`permanent_region_id`) REFERENCES `regions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_current_brg_id_fkey` FOREIGN KEY (`current_brg_id`) REFERENCES `barangays`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_current_citymun_id_fkey` FOREIGN KEY (`current_citymun_id`) REFERENCES `citymuns`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_current_province_id_fkey` FOREIGN KEY (`current_province_id`) REFERENCES `provinces`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_current_region_id_fkey` FOREIGN KEY (`current_region_id`) REFERENCES `regions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_g12_school_id_fkey` FOREIGN KEY (`g12_school_id`) REFERENCES `schools`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_college_school_id_fkey` FOREIGN KEY (`college_school_id`) REFERENCES `schools`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announcementLocation` ADD CONSTRAINT `announcementLocation_announcement_id_fkey` FOREIGN KEY (`announcement_id`) REFERENCES `announcement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schools` ADD CONSTRAINT `schools_province_id_fkey` FOREIGN KEY (`province_id`) REFERENCES `provinces`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schools` ADD CONSTRAINT `schools_citymun_id_fkey` FOREIGN KEY (`citymun_id`) REFERENCES `citymuns`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schools` ADD CONSTRAINT `schools_brgy_id_fkey` FOREIGN KEY (`brgy_id`) REFERENCES `barangays`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
