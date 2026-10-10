-- Per-quotation terms: GST, a named flat discount, the printed date and the
-- payment schedule snapshot; and the studio's GST default.
ALTER TABLE "studio_quotes" ADD COLUMN "gstBps" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "studio_quotes" ADD COLUMN "onSpotLabel" TEXT;
ALTER TABLE "studio_quotes" ADD COLUMN "quoteDate" DATE;
ALTER TABLE "studio_quotes" ADD COLUMN "phases" JSONB;
ALTER TABLE "studio_branding" ADD COLUMN "gstBps" INTEGER NOT NULL DEFAULT 0;
