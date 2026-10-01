/*
  Warnings:

  - You are about to drop the column `parentModule` on the `module` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `module` DROP COLUMN `parentModule`,
    ADD COLUMN `parent_id` BINARY(16) NULL;

-- AddForeignKey
ALTER TABLE `module` ADD CONSTRAINT `module_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `module`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
