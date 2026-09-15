-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` BINARY(16) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `created_by` BINARY(16) NULL,
    `updated_by` BINARY(16) NULL,
    `recordStatus` BOOLEAN NULL DEFAULT true,

    UNIQUE INDEX `user_id`(`user_id`),
    UNIQUE INDEX `email`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permission_role` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `role_id` INTEGER NOT NULL,
    `permission_id` INTEGER NOT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `permission_id`(`permission_id`),
    UNIQUE INDEX `role_id`(`role_id`, `permission_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `created_by` BINARY(16) NULL,
    `updated_by` BINARY(16) NULL,
    `recordStatus` BOOLEAN NULL DEFAULT true,

    UNIQUE INDEX `name`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_user` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `role_id` INTEGER NOT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `role_id`(`role_id`),
    UNIQUE INDEX `user_id`(`user_id`, `role_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `created_by` BINARY(16) NULL,
    `updated_by` BINARY(16) NULL,
    `recordStatus` BOOLEAN NULL DEFAULT true,

    UNIQUE INDEX `name`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `siblings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `student_id` INTEGER NOT NULL,
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
    `recordStatus` BOOLEAN NULL DEFAULT true,

    INDEX `student_id`(`student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `staff` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `first_name` VARCHAR(255) NOT NULL,
    `middle_name` VARCHAR(255) NULL,
    `last_name` VARCHAR(255) NOT NULL,
    `extension_name` VARCHAR(255) NULL,
    `sex` VARCHAR(10) NOT NULL,
    `position` VARCHAR(255) NOT NULL,
    `department` VARCHAR(255) NULL,
    `email_address` VARCHAR(255) NOT NULL,
    `mobile_number` VARCHAR(15) NOT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `created_by` BINARY(16) NULL,
    `updated_by` BINARY(16) NULL,
    `recordStatus` BOOLEAN NULL DEFAULT true,

    UNIQUE INDEX `email_address`(`email_address`),
    INDEX `user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `students` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `student_id` BINARY(16) NOT NULL,
    `user_id` INTEGER NOT NULL,
    `first_name` VARCHAR(255) NOT NULL,
    `middle_name` VARCHAR(255) NULL,
    `last_name` VARCHAR(255) NOT NULL,
    `extension_name` VARCHAR(255) NULL,
    `sex` VARCHAR(10) NOT NULL,
    `place_of_birth` VARCHAR(255) NOT NULL,
    `birthdate` DATE NOT NULL,
    `height` FLOAT NULL,
    `weight` FLOAT NULL,
    `permanent_address` TEXT NOT NULL,
    `current_address` TEXT NOT NULL,
    `email_address` VARCHAR(255) NOT NULL,
    `mobile_number` VARCHAR(15) NOT NULL,
    `is_solo_parent` BOOLEAN NOT NULL,
    `is_child_of_solo_parent` BOOLEAN NOT NULL,
    `is_indigenous_people` BOOLEAN NOT NULL,
    `indigenous_group` VARCHAR(255) NULL,
    `is_sped` BOOLEAN NOT NULL,
    `is_pwd` BOOLEAN NOT NULL,
    `emergency_contact_name` VARCHAR(255) NOT NULL,
    `emergency_contact_number` VARCHAR(15) NOT NULL,
    `academic_strand` VARCHAR(255) NOT NULL,
    `program_name` VARCHAR(255) NOT NULL,
    `award_honor` VARCHAR(255) NULL,
    `organization` VARCHAR(255) NULL,
    `school_name` VARCHAR(255) NOT NULL,
    `school_address` VARCHAR(255) NOT NULL,
    `school_type` ENUM('Private', 'Public') NOT NULL,
    `year_of_graduation` INTEGER NOT NULL,
    `current_program_name` VARCHAR(255) NOT NULL,
    `current_year_level` INTEGER NOT NULL,
    `current_award_honor` VARCHAR(255) NULL,
    `current_organization` VARCHAR(255) NULL,
    `current_school_name` VARCHAR(255) NOT NULL,
    `current_school_address` VARCHAR(255) NOT NULL,
    `current_school_type` ENUM('Private', 'Public') NOT NULL,
    `father_last_name` VARCHAR(255) NOT NULL,
    `father_first_name` VARCHAR(255) NOT NULL,
    `father_middle_name` VARCHAR(255) NULL,
    `father_extension` VARCHAR(255) NULL,
    `father_occupation` VARCHAR(255) NOT NULL,
    `father_income` FLOAT NULL,
    `father_mobile_number` VARCHAR(15) NOT NULL,
    `mother_maiden_last_name` VARCHAR(255) NOT NULL,
    `mother_maiden_first_name` VARCHAR(255) NOT NULL,
    `mother_maiden_middle_name` VARCHAR(255) NULL,
    `mother_maiden_extension` VARCHAR(255) NULL,
    `mother_occupation` VARCHAR(255) NOT NULL,
    `mother_income` FLOAT NULL,
    `mother_mobile_number` VARCHAR(15) NOT NULL,
    `guardian_last_name` VARCHAR(255) NOT NULL,
    `guardian_first_name` VARCHAR(255) NOT NULL,
    `guardian_middle_name` VARCHAR(255) NULL,
    `guardian_extension` VARCHAR(255) NULL,
    `guardian_occupation` VARCHAR(255) NOT NULL,
    `guardian_income` FLOAT NULL,
    `guardian_mobile_number` VARCHAR(15) NOT NULL,
    `number_of_siblings` INTEGER NOT NULL,
    `emergency_contact_name2` VARCHAR(255) NOT NULL,
    `emergency_contact_number2` VARCHAR(15) NOT NULL,
    `applicationForm` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `created_by` BINARY(16) NULL,
    `updated_by` BINARY(16) NULL,
    `recordStatus` BOOLEAN NULL DEFAULT true,

    UNIQUE INDEX `student_id`(`student_id`),
    UNIQUE INDEX `email_address`(`email_address`),
    INDEX `user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `permission_role` ADD CONSTRAINT `permission_role_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `permission_role` ADD CONSTRAINT `permission_role_ibfk_2` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `role_user` ADD CONSTRAINT `role_user_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `role_user` ADD CONSTRAINT `role_user_ibfk_2` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `siblings` ADD CONSTRAINT `siblings_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `staff` ADD CONSTRAINT `staff_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
