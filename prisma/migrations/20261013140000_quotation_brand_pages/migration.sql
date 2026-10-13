-- Quotation PDF (owner, 13 Oct 2026): up to three full-page brand images a
-- studio designed (cover, "Why choose us", partners), printed before every
-- quotation. Storage paths in the private logo bucket, never public URLs.
-- A column on an existing table (RLS already on); no new table.
ALTER TABLE "studio_branding" ADD COLUMN "brandPages" TEXT[] DEFAULT ARRAY[]::TEXT[];
