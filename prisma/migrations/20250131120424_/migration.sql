/*
  Warnings:

  - You are about to drop the column `email_address` on the `staff` table. All the data in the column will be lost.
  - You are about to drop the column `email_address` on the `students` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[email]` on the table `staff` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email]` on the table `students` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `email` to the `staff` table without a default value. This is not possible if the table is not empty.
  - Added the required column `email` to the `students` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `email_address` ON `staff`;

-- DropIndex
DROP INDEX `email_address` ON `students`;

-- AlterTable
ALTER TABLE `staff` DROP COLUMN `email_address`,
    ADD COLUMN `email` VARCHAR(255) NOT NULL;

-- AlterTable
ALTER TABLE `students` DROP COLUMN `email_address`,
    ADD COLUMN `email` VARCHAR(255) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `email` ON `staff`(`email`);

-- CreateIndex
CREATE UNIQUE INDEX `email` ON `students`(`email`);
