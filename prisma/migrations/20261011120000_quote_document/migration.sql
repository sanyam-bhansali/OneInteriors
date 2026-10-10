-- The quotation document: the studio's material specification and how long a
-- quotation holds its prices; and backups of a product master before bulk changes.
ALTER TABLE "studio_branding" ADD COLUMN "materialSpec" JSONB;
ALTER TABLE "studio_branding" ADD COLUMN "validityDays" INTEGER NOT NULL DEFAULT 30;

CREATE TABLE "studio_product_backups" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "rows" JSONB NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "studio_product_backups_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "studio_product_backups_studioId_takenAt_idx" ON "studio_product_backups"("studioId", "takenAt");
ALTER TABLE "studio_product_backups" ADD CONSTRAINT "studio_product_backups_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Private rates: no client role may read it (the app reaches it through Prisma).
ALTER TABLE "studio_product_backups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_product_backups" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "studio_product_backups" FROM anon, authenticated;
