-- AlterTable
ALTER TABLE `schedule` ADD COLUMN `batch_code` VARCHAR(255) NULL,
    ADD COLUMN `examination_type` ENUM('ONSITE', 'ONLINE') NULL,
    ADD COLUMN `proctor_interviewer` VARCHAR(255) NULL;
