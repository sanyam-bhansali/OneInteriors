-- GST on part of the project (owner, 21 Nov 2026): set on the project's
-- Payments tab. Expand only: two columns, nothing changes until it is set.
ALTER TABLE "home_projects" ADD COLUMN "gstPctOfValue" INTEGER;
ALTER TABLE "home_projects" ADD COLUMN "gstPaise" BIGINT NOT NULL DEFAULT 0;
