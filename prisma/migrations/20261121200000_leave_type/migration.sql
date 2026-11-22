-- Casual and sick leave, one of each a month (owner, 21 Nov 2026).
ALTER TABLE "studio_leaves" ADD COLUMN "type" TEXT;
-- A half day, marked by the owner, the design head or a sales head (owner, 21 Nov 2026).
ALTER TABLE "studio_leaves" ADD COLUMN "halfDay" BOOLEAN NOT NULL DEFAULT false;
