-- Document Tracking System (DTS): setup lookups (process types, purposes,
-- destination offices), tracks, append-only track history, per-year track
-- number sequence, and users.dts_office_id office assignment. Additive only.
-- AlterTable
ALTER TABLE `users` ADD COLUMN `dts_office_id` BINARY(16) NULL;

-- CreateTable
CREATE TABLE `dts_process_types` (
    `id` BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID())),
    `name` VARCHAR(150) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `record_status` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` BINARY(16) NULL,
    `updated_by` BINARY(16) NULL,

    UNIQUE INDEX `dts_process_types_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dts_purposes` (
    `id` BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID())),
    `name` VARCHAR(150) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `record_status` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` BINARY(16) NULL,
    `updated_by` BINARY(16) NULL,

    UNIQUE INDEX `dts_purposes_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dts_offices` (
    `id` BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID())),
    `name` VARCHAR(150) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `record_status` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` BINARY(16) NULL,
    `updated_by` BINARY(16) NULL,

    UNIQUE INDEX `dts_offices_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dts_sequences` (
    `year` INTEGER NOT NULL,
    `last_value` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`year`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dts_tracks` (
    `id` BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID())),
    `track_number` VARCHAR(20) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `particulars` TEXT NOT NULL,
    `process_type_id` BINARY(16) NOT NULL,
    `purpose_id` BINARY(16) NOT NULL,
    `sponsorship_id` BINARY(16) NOT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'IN_PROCESSED', 'FORWARDED', 'RETURNED', 'DONE') NOT NULL DEFAULT 'DRAFT',
    `origin_office_id` BINARY(16) NULL,
    `current_office_id` BINARY(16) NULL,
    `intended_destination_id` BINARY(16) NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `submitted_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `completed_by` BINARY(16) NULL,
    `record_status` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` BINARY(16) NOT NULL,
    `updated_by` BINARY(16) NULL,

    UNIQUE INDEX `dts_tracks_track_number_key`(`track_number`),
    INDEX `dts_tracks_status_idx`(`status`),
    INDEX `dts_tracks_current_office_id_idx`(`current_office_id`),
    INDEX `dts_tracks_sponsorship_id_idx`(`sponsorship_id`),
    INDEX `dts_tracks_created_by_idx`(`created_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dts_track_histories` (
    `id` BINARY(16) NOT NULL DEFAULT (UUID_TO_BIN(UUID())),
    `track_id` BINARY(16) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `action` ENUM('CREATED', 'SUBMITTED', 'ACCEPTED', 'FORWARDED', 'RETURNED', 'DONE') NOT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'IN_PROCESSED', 'FORWARDED', 'RETURNED', 'DONE') NOT NULL,
    `from_office_id` BINARY(16) NULL,
    `from_office_name` VARCHAR(150) NULL,
    `to_office_id` BINARY(16) NULL,
    `to_office_name` VARCHAR(150) NULL,
    `remarks` TEXT NULL,
    `actor_user_id` BINARY(16) NOT NULL,
    `actor_name` VARCHAR(255) NOT NULL,
    `actor_office_id` BINARY(16) NULL,
    `actor_office_name` VARCHAR(150) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `dts_track_histories_track_id_sequence_key`(`track_id`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_dts_office_id_fkey` FOREIGN KEY (`dts_office_id`) REFERENCES `dts_offices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dts_tracks` ADD CONSTRAINT `dts_tracks_process_type_id_fkey` FOREIGN KEY (`process_type_id`) REFERENCES `dts_process_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dts_tracks` ADD CONSTRAINT `dts_tracks_purpose_id_fkey` FOREIGN KEY (`purpose_id`) REFERENCES `dts_purposes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dts_tracks` ADD CONSTRAINT `dts_tracks_sponsorship_id_fkey` FOREIGN KEY (`sponsorship_id`) REFERENCES `sponsorships`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dts_tracks` ADD CONSTRAINT `dts_tracks_origin_office_id_fkey` FOREIGN KEY (`origin_office_id`) REFERENCES `dts_offices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dts_tracks` ADD CONSTRAINT `dts_tracks_current_office_id_fkey` FOREIGN KEY (`current_office_id`) REFERENCES `dts_offices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dts_tracks` ADD CONSTRAINT `dts_tracks_intended_destination_id_fkey` FOREIGN KEY (`intended_destination_id`) REFERENCES `dts_offices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dts_tracks` ADD CONSTRAINT `dts_tracks_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dts_track_histories` ADD CONSTRAINT `dts_track_histories_track_id_fkey` FOREIGN KEY (`track_id`) REFERENCES `dts_tracks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dts_track_histories` ADD CONSTRAINT `dts_track_histories_from_office_id_fkey` FOREIGN KEY (`from_office_id`) REFERENCES `dts_offices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dts_track_histories` ADD CONSTRAINT `dts_track_histories_to_office_id_fkey` FOREIGN KEY (`to_office_id`) REFERENCES `dts_offices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dts_track_histories` ADD CONSTRAINT `dts_track_histories_actor_office_id_fkey` FOREIGN KEY (`actor_office_id`) REFERENCES `dts_offices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dts_track_histories` ADD CONSTRAINT `dts_track_histories_actor_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

