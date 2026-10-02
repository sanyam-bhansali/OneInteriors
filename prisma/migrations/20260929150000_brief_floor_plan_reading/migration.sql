-- The confirmed reading of a customer's floor plan.
--
-- The facts the quote uses — kitchen platform run, bathrooms, study, where
-- the carpet area came from — written after the customer confirms "We read:
-- … — right?", never straight from the model. The file itself stays in the
-- private floor-plans bucket (briefs.floorPlanPath).
--
-- Generated offline with `prisma migrate diff`. Additive; nullable. Safe to
-- `db:deploy`.

-- AlterTable
ALTER TABLE "briefs" ADD COLUMN "floorPlanReading" JSONB;
