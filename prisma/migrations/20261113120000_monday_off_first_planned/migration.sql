-- Design dates (owner, 13 Nov 2026). Expand only.
--
-- 1. Each step keeps the day it was first planned for, so the studio sees the
--    planned day and the current one side by side ("har case mein dikhana
--    hai"). Existing steps: the day of their first recorded move, else today's
--    planned day.
ALTER TABLE "home_checklist_items" ADD COLUMN "firstPlannedOn" DATE;

UPDATE "home_checklist_items" AS i
SET "firstPlannedOn" = COALESCE(
  (SELECT d."fromDate" FROM "home_step_delays" AS d WHERE d."stepId" = i."id" ORDER BY d."at" ASC LIMIT 1),
  i."plannedOn"
)
WHERE i."firstPlannedOn" IS NULL;

-- 2. Monday is the weekly off for everyone ("Monday being our weekly off, it
--    should be considered in the overall planning for both design and
--    execution"): Tuesday to Sunday are working days.
ALTER TABLE "studios" ALTER COLUMN "workingDays" SET DEFAULT ARRAY[2, 3, 4, 5, 6, 7]::INTEGER[];
UPDATE "studios" SET "workingDays" = ARRAY[2, 3, 4, 5, 6, 7]::INTEGER[];
