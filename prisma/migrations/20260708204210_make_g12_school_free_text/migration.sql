-- AlterTable
ALTER TABLE `students` ADD COLUMN `g12_school_name` VARCHAR(255) NULL;

-- Backfill: copy the referenced school's name into the new free-text column so existing
-- applicants keep their displayed G12 school. The g12_school_id FK column is retained
-- (non-destructive) and dropped in a later migration.
UPDATE `students` s
JOIN `schools` sch ON s.`g12_school_id` = sch.`id`
SET s.`g12_school_name` = sch.`school_name`
WHERE s.`g12_school_id` IS NOT NULL;
