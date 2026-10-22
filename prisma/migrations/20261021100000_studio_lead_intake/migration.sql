-- Lead intake (21 Oct 2026; docs/studio-os/LEAD-INTAKE.md): leads landing on a
-- studio's board by themselves from Meta lead ads (Facebook and Instagram),
-- Google Ads lead forms, the studio's own website, and portals or WhatsApp
-- tools posting to a webhook.
-- Expand only: two enums, two new tables. Nothing dropped, nothing backfilled.
--
-- studio_lead_connections: one door per source. secretHash is the SHA-256 of
-- a random secret shown to the owner once; the secret itself is never stored.
-- metaPageId (META_PAGE only) is unique when set, so one Facebook Page lands
-- in one studio.
--
-- studio_lead_intake_events: one row per incoming lead, unique on
-- (connectionId, externalId), so a Meta or Google retry of the same lead can
-- never make a second card. No payload is kept.
--
-- RLS on, no policies: reached only through Prisma on the server, like every
-- studio table.

-- CreateEnum
CREATE TYPE "LeadConnectionKind" AS ENUM ('WEBSITE', 'GOOGLE_LEAD_FORM', 'PORTAL', 'META_PAGE');

-- CreateEnum
CREATE TYPE "LeadIntakeStatus" AS ENUM ('RECEIVED', 'LANDED', 'FAILED', 'DUPLICATE');

-- CreateTable
CREATE TABLE "studio_lead_connections" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "kind" "LeadConnectionKind" NOT NULL,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "secretHash" TEXT NOT NULL,
    "metaPageId" TEXT,
    "lastEventAt" TIMESTAMP(3),
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "studio_lead_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_lead_intake_events" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "status" "LeadIntakeStatus" NOT NULL DEFAULT 'RECEIVED',
    "clientId" TEXT,
    "error" TEXT,
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_lead_intake_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "studio_lead_connections_metaPageId_key" ON "studio_lead_connections"("metaPageId");

-- CreateIndex
CREATE INDEX "studio_lead_connections_studioId_idx" ON "studio_lead_connections"("studioId");

-- CreateIndex
CREATE INDEX "studio_lead_intake_events_connectionId_createdAt_idx" ON "studio_lead_intake_events"("connectionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "studio_lead_intake_events_connectionId_externalId_key" ON "studio_lead_intake_events"("connectionId", "externalId");

-- AddForeignKey
ALTER TABLE "studio_lead_connections" ADD CONSTRAINT "studio_lead_connections_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_lead_intake_events" ADD CONSTRAINT "studio_lead_intake_events_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "studio_lead_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row level security: closed to the anon and authenticated roles.
ALTER TABLE "studio_lead_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_lead_connections" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_lead_connections" FROM anon, authenticated;

ALTER TABLE "studio_lead_intake_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "studio_lead_intake_events" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "studio_lead_intake_events" FROM anon, authenticated;
