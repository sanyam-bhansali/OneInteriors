-- New leads go to, ad attribution, and Meta conversion feedback (owner,
-- 22 Oct 2026; docs/studio-os/LEAD-INTAKE.md).
-- Expand only: two enums, new nullable or defaulted columns, one new table,
-- one index. Nothing dropped, renamed or backfilled; every studio stays on
-- POOL (today's behaviour) with Meta feedback off.
--
-- studios: "New leads go to" (leadRouteMode POOL | PERSON | TURNS, the chosen
-- member, the turn list, and the TURNS counter bumped atomically in the
-- landing transaction), and the Conversions API switch and per-column events.
-- No dataset id or token: those live only in the STUDIO_META_CAPI env var.
--
-- studio_lead_connections: an optional per-door override of the studio's rule.
--
-- studio_clients: ad attribution columns (platform, Meta leadgen id, campaign,
-- ad set, ad and form ids and names, gclid, utm JSON) and an index on
-- (studioId, campaignId) for "By campaign" on lead analytics.
--
-- studio_conversion_events: the Conversions API outbox, unique on
-- (clientId, eventName) so each event is sent at most once per lead. No
-- payload is kept. RLS on, no policies, privileges revoked: reached only
-- through Prisma on the server, like every studio table.

-- CreateEnum
CREATE TYPE "LeadRouteMode" AS ENUM ('POOL', 'PERSON', 'TURNS');

-- CreateEnum
CREATE TYPE "ConversionEventStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "studios" ADD COLUMN "leadRouteMode" "LeadRouteMode" NOT NULL DEFAULT 'POOL',
ADD COLUMN "leadRouteMemberId" TEXT,
ADD COLUMN "leadRouteTurnIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "leadRouteTurn" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "metaCapiEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "metaCapiStages" JSONB;

-- AlterTable
ALTER TABLE "studio_lead_connections" ADD COLUMN "routeMode" "LeadRouteMode",
ADD COLUMN "routeMemberId" TEXT;

-- AlterTable
ALTER TABLE "studio_clients" ADD COLUMN "adPlatform" TEXT,
ADD COLUMN "leadgenId" TEXT,
ADD COLUMN "campaignId" TEXT,
ADD COLUMN "campaignName" TEXT,
ADD COLUMN "adsetId" TEXT,
ADD COLUMN "adsetName" TEXT,
ADD COLUMN "adId" TEXT,
ADD COLUMN "adName" TEXT,
ADD COLUMN "formId" TEXT,
ADD COLUMN "gclid" TEXT,
ADD COLUMN "utm" JSONB;

-- CreateTable
CREATE TABLE "studio_conversion_events" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "stageId" TEXT,
    "status" "ConversionEventStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_conversion_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "studio_clients_studioId_campaignId_idx" ON "studio_clients"("studioId", "campaignId");

-- CreateIndex
CREATE INDEX "studio_conversion_events_studioId_createdAt_idx" ON "studio_conversion_events"("studioId", "createdAt");

-- CreateIndex
CREATE INDEX "studio_conversion_events_status_updatedAt_idx" ON "studio_conversion_events"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "studio_conversion_events_clientId_eventName_key" ON "studio_conversion_events"("clientId", "eventName");

-- AddForeignKey
ALTER TABLE "studio_conversion_events" ADD CONSTRAINT "studio_conversion_events_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_conversion_events" ADD CONSTRAINT "studio_conversion_events_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "studio_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row level security: closed to the anon and authenticated roles.
ALTER TABLE "studio_conversion_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_conversion_events" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_conversion_events" FROM anon, authenticated;
