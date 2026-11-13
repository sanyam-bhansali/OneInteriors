-- Meta lead ads, connected from the studio app (owner, 12 Nov 2026):
-- "Connect Facebook" keeps each Page's token sealed on its connection, the
-- owner picks which campaigns' leads come in (others are SKIPPED), and past
-- leads (Meta keeps 90 days) can be brought in once.
-- Expand only: a new enum value, nullable or defaulted columns, a new table.

ALTER TYPE "LeadIntakeStatus" ADD VALUE 'SKIPPED';

ALTER TABLE "studio_lead_connections" ADD COLUMN "metaBackfillAt" TIMESTAMP(3),
ADD COLUMN "metaCampaignIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "metaCampaigns" JSONB,
ADD COLUMN "metaConnectedAt" TIMESTAMP(3),
ADD COLUMN "metaOnlyCampaigns" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "metaPageName" TEXT,
ADD COLUMN "metaTokenSealed" TEXT;

ALTER TABLE "studio_lead_intake_events" ADD COLUMN "campaignId" TEXT,
ADD COLUMN "campaignName" TEXT;

CREATE TABLE "studio_meta_logins" (
    "studioId" TEXT NOT NULL,
    "tokenSealed" TEXT NOT NULL,
    "fbUserName" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_meta_logins_pkey" PRIMARY KEY ("studioId")
);

ALTER TABLE "studio_meta_logins" ADD CONSTRAINT "studio_meta_logins_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS on, no policies: reached only through Prisma on the server.
ALTER TABLE "studio_meta_logins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_meta_logins" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_meta_logins" FROM anon, authenticated;
