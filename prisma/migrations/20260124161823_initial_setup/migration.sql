-- CreateTable
CREATE TABLE `users` (
    `id` BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID())),
    `role_id` BINARY(16) NOT NULL,
    `first_name` VARCHAR(255) NOT NULL,
    `middle_name` VARCHAR(255) NULL,
    `last_name` VARCHAR(255) NOT NULL,
    `username` VARCHAR(255) NOT NULL DEFAULT 'user',
    `mobile_number` VARCHAR(15) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `created_by` BINARY(16) NULL,
    `updated_by` BINARY(16) NULL,
    `record_status` BOOLEAN NULL DEFAULT true,
    `profile` VARCHAR(255) NULL,

    UNIQUE INDEX `email`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID())),
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `created_by` BINARY(16) NULL,
    `updated_by` BINARY(16) NULL,
    `record_status` BOOLEAN NULL DEFAULT true,

    UNIQUE INDEX `name`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `module` (
    `id` BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID())),
    `name` VARCHAR(191) NOT NULL,
    `parentModule` INTEGER NULL,
    `sorter` INTEGER NOT NULL,
    `record_status` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `modulePermission` (
    `id` BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID())),
    `role_id` BINARY(16) NOT NULL,
    `module_id` BINARY(16) NOT NULL,
    `show` BOOLEAN NOT NULL DEFAULT false,
    `edit` BOOLEAN NOT NULL DEFAULT false,
    `save` BOOLEAN NOT NULL DEFAULT false,
    `delete` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `siblings` (
    `id` BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID())),
    `student_id` BINARY(16) NOT NULL,
    `sibling_name` VARCHAR(255) NOT NULL,
    `sibling_bdate` DATE NOT NULL,
    `sibling_age` INTEGER NOT NULL,
    `sibling_status` ENUM('Single', 'Married', 'Widowed', 'Divorced') NOT NULL,
    `living_with_parents` BOOLEAN NOT NULL,
    `own_house` BOOLEAN NOT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `created_by` BINARY(16) NULL,
    `updated_by` BINARY(16) NULL,
    `record_status` BOOLEAN NULL DEFAULT true,

    INDEX `student_id`(`student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `students` (
    `id` BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID())),
    `user_id` BINARY(16) NOT NULL,
    `first_name` VARCHAR(255) NOT NULL,
    `middle_name` VARCHAR(255) NULL,
    `last_name` VARCHAR(255) NOT NULL,
    `extension_name` VARCHAR(255) NULL,
    `sex` VARCHAR(10) NULL,
    `place_of_birth` VARCHAR(255) NULL,
    `birthdate` DATE NULL,
    `height` FLOAT NULL,
    `weight` FLOAT NULL,
    `permanent_street` VARCHAR(255) NULL,
    `permanent_brg_id` INTEGER NULL,
    `permanent_citymun_id` INTEGER NULL,
    `permanent_province_id` INTEGER NULL,
    `permanent_region_id` INTEGER NULL,
    `permanent_zip_code` INTEGER NULL,
    `permanent_country` VARCHAR(255) NULL DEFAULT 'Philippines',
    `current_street` VARCHAR(255) NULL,
    `current_brg_id` INTEGER NULL,
    `current_citymun_id` INTEGER NULL,
    `current_province_id` INTEGER NULL,
    `current_region_id` INTEGER NULL,
    `current_zip_code` INTEGER NULL,
    `current_country` VARCHAR(255) NULL DEFAULT 'Philippines',
    `email` VARCHAR(255) NULL,
    `mobile_number` VARCHAR(15) NULL,
    `is_solo_parent` BOOLEAN NULL,
    `is_child_of_solo_parent` BOOLEAN NULL,
    `is_indigenous_people` BOOLEAN NULL,
    `indigenous_group` VARCHAR(255) NULL,
    `is_sped` BOOLEAN NULL,
    `is_pwd` BOOLEAN NULL,
    `emergency_contact_name` VARCHAR(255) NULL,
    `emergency_contact_number` VARCHAR(15) NULL,
    `emergency_contact_name2` VARCHAR(255) NULL,
    `emergency_contact_number2` VARCHAR(15) NULL,
    `g12_academic_strand` VARCHAR(255) NULL,
    `g12_program_name` VARCHAR(255) NULL,
    `g12_award_honor` VARCHAR(255) NULL,
    `g12_organization` VARCHAR(255) NULL,
    `g12_year_of_graduation` INTEGER NULL,
    `g12_school_id` BINARY(16) NULL,
    `college_program_name` VARCHAR(255) NULL,
    `college_year_level` INTEGER NULL,
    `college_award_honor` VARCHAR(255) NULL,
    `college_organization` VARCHAR(255) NULL,
    `college_school_id` BINARY(16) NULL,
    `father_last_name` VARCHAR(255) NULL,
    `father_first_name` VARCHAR(255) NULL,
    `father_middle_name` VARCHAR(255) NULL,
    `father_extension` VARCHAR(255) NULL,
    `father_occupation` VARCHAR(255) NULL,
    `father_income` FLOAT NULL,
    `father_mobile_number` VARCHAR(15) NULL,
    `mother_maiden_last_name` VARCHAR(255) NULL,
    `mother_maiden_first_name` VARCHAR(255) NULL,
    `mother_maiden_middle_name` VARCHAR(255) NULL,
    `mother_maiden_extension` VARCHAR(255) NULL,
    `mother_occupation` VARCHAR(255) NULL,
    `mother_income` FLOAT NULL,
    `mother_mobile_number` VARCHAR(15) NULL,
    `guardian_last_name` VARCHAR(255) NULL,
    `guardian_first_name` VARCHAR(255) NULL,
    `guardian_middle_name` VARCHAR(255) NULL,
    `guardian_extension` VARCHAR(255) NULL,
    `guardian_occupation` VARCHAR(255) NULL,
    `guardian_income` FLOAT NULL,
    `guardian_mobile_number` VARCHAR(15) NULL,
    `number_of_siblings` INTEGER NULL,
    `gwa` FLOAT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `created_by` BINARY(16) NULL,
    `updated_by` BINARY(16) NULL,
    `record_status` BOOLEAN NULL DEFAULT true,

    UNIQUE INDEX `email`(`email`),
    INDEX `user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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
    `id` BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID())),
    `province_id` INTEGER NOT NULL,
    `citymun_id` INTEGER NOT NULL,
    `brgy_id` INTEGER NOT NULL,
    `school_name` VARCHAR(191) NOT NULL,
    `school_type` VARCHAR(191) NOT NULL,
    `record_status` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NULL,
    `created_by` BINARY(16) NULL,
    `updated_by` BINARY(16) NULL,

    INDEX `schools_province_id_idx`(`province_id`),
    INDEX `schools_citymun_id_idx`(`citymun_id`),
    INDEX `schools_brgy_id_idx`(`brgy_id`),
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
ALTER TABLE `modulePermission` ADD CONSTRAINT `modulePermission_module_id_fkey` FOREIGN KEY (`module_id`) REFERENCES `module`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `modulePermission` ADD CONSTRAINT `modulePermission_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `siblings` ADD CONSTRAINT `siblings_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

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
ALTER TABLE `announcements` ADD CONSTRAINT `announcements_sponsorship_id_fkey` FOREIGN KEY (`sponsorship_id`) REFERENCES `sponsorships`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announcementLocations` ADD CONSTRAINT `announcementLocations_announcement_id_fkey` FOREIGN KEY (`announcement_id`) REFERENCES `announcements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announcementLocations` ADD CONSTRAINT `announcementLocations_citymun_id_fkey` FOREIGN KEY (`citymun_id`) REFERENCES `citymuns`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announcementFiles` ADD CONSTRAINT `announcementFiles_announcement_id_fkey` FOREIGN KEY (`announcement_id`) REFERENCES `announcements`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schools` ADD CONSTRAINT `schools_province_id_fkey` FOREIGN KEY (`province_id`) REFERENCES `provinces`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schools` ADD CONSTRAINT `schools_citymun_id_fkey` FOREIGN KEY (`citymun_id`) REFERENCES `citymuns`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schools` ADD CONSTRAINT `schools_brgy_id_fkey` FOREIGN KEY (`brgy_id`) REFERENCES `barangays`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

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
