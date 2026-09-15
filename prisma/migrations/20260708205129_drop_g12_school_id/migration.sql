/*
  Warnings:

  - You are about to drop the column `g12_school_id` on the `students` table. All the data in the column will be lost.

  This is the deferred cleanup for the "G12 school becomes free text" change. It is SAFE for the
  rest of the students table: DROP COLUMN is column-scoped and does not touch any other column or
  delete any rows. The g12_school_id values were already mirrored into g12_school_name by the
  earlier migration `20260708204210_make_g12_school_free_text` (backfill), which always runs first.

  BEFORE deploying to a populated DB, verify no student would lose its only G12 reference
  (id set but name NULL because the referenced school was deleted):

    SELECT COUNT(*) FROM students s
    LEFT JOIN schools sch ON s.g12_school_id = sch.id
    WHERE s.g12_school_id IS NOT NULL AND s.g12_school_name IS NULL;

  Expect 0. If non-zero, set a placeholder name for those rows before applying.

  ALGORITHM=INPLACE, LOCK=NONE uses InnoDB online DDL so the drop does not lock the table on a
  large students table. If your MySQL/engine rejects LOCK=NONE for this operation, remove the
  clause and run inside a maintenance window instead.
*/
-- DropForeignKey
ALTER TABLE `students` DROP FOREIGN KEY `students_g12_school_id_fkey`;

-- DropIndex
DROP INDEX `students_g12_school_id_fkey` ON `students`;

-- AlterTable
ALTER TABLE `students` DROP COLUMN `g12_school_id`, ALGORITHM=INPLACE, LOCK=NONE;
