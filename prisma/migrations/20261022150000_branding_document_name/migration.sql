-- The name at the top of a studio's quotations (owner, 22 Oct 2026: Hauspire
-- prints "HAUSPIRE"). Null keeps the trading name. A column on studio_branding,
-- which already has row-level security.
ALTER TABLE "studio_branding" ADD COLUMN "documentName" TEXT;
