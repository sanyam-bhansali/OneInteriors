-- The handover is worked out and shown only once design is complete (owner, 21 Nov 2026).
-- Projects already past design keep their plan as it stands: their execution counts as planned now.
ALTER TABLE "home_projects" ADD COLUMN "executionPlannedAt" TIMESTAMP(3);
UPDATE "home_projects" SET "executionPlannedAt" = NOW() WHERE "phase" <> 'DESIGN';
