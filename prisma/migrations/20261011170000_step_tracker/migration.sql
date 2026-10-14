-- The step tracker (owner, 11 Oct 2026; docs/studio-workspace/STEP-TRACKER.md):
-- a project's plan becomes Hauspire's execution steps, each with a weight,
-- instead of the room checklist generated from the quote's lines. Ticking a
-- step needs a photo with a sentence, which lands in that day's site log.
--
-- `home_checklist_items` becomes the step:
-- * `weightBp`: the step's weight in basis points (10 000 = 100%);
-- * `inScope`: false = not in scope for this home, its weight shared across
--   the in-scope steps (project/step-rules.ts);
-- * `plannedOn`: the step's planned day inside its stage's window;
-- * `donePhotoId`: the `home_site_log_photos` row that ticked it, one photo
--   per step (unique), SET NULL if the photo row ever goes (it does not:
--   site-log photos are never deleted).
-- `ChecklistDoneSource` gains BACKFILL, for steps ticked without a photo by
-- scripts/studio/steps-from-template.ts because their stage was already done.
--
-- Expand-only: one enum value, four columns that are nullable or defaulted,
-- one unique index, one foreign key. Nothing is dropped, renamed or
-- backfilled here; existing projects get their steps from the script, run by
-- the owner after this is applied. No new table, so no new row-level
-- security: `home_checklist_items` has had it since 20261011140000.

-- AlterEnum
ALTER TYPE "ChecklistDoneSource" ADD VALUE 'BACKFILL';

-- AlterTable
ALTER TABLE "home_checklist_items" ADD COLUMN     "weightBp" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "inScope" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "plannedOn" DATE,
ADD COLUMN     "donePhotoId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "home_checklist_items_donePhotoId_key" ON "home_checklist_items"("donePhotoId");

-- AddForeignKey
ALTER TABLE "home_checklist_items" ADD CONSTRAINT "home_checklist_items_donePhotoId_fkey" FOREIGN KEY ("donePhotoId") REFERENCES "home_site_log_photos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
