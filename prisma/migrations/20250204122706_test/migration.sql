/*
  Warnings:

  - You are about to drop the column `applicationForm` on the `students` table. All the data in the column will be lost.
  - Added the required column `application_form` to the `students` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `students` DROP COLUMN `applicationForm`,
    ADD COLUMN `application_form` VARCHAR(255) NOT NULL;
