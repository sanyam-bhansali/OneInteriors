-- AlterTable
ALTER TABLE "studios" ADD COLUMN     "headline" TEXT,
ADD COLUMN     "notFor" TEXT;

-- CreateTable
CREATE TABLE "profile_drafts" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "introduction" TEXT NOT NULL,
    "notFor" TEXT NOT NULL,
    "stories" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "issues" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,

    CONSTRAINT "profile_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profile_drafts_studioId_key" ON "profile_drafts"("studioId");

-- AddForeignKey
ALTER TABLE "profile_drafts" ADD CONSTRAINT "profile_drafts_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────────
-- RLS lockdown. Supabase's PostgREST exposes every table in `public`
-- to the anon and authenticated roles by default; Prisma-created
-- tables get no policies, so without this block the table is world
-- readable AND writable over HTTP. Run this in EVERY migration that
-- adds a table. Prisma connects as `postgres`, which has
-- rolbypassrls, so it is unaffected.
--
-- This one matters more than most: an unapproved draft is copy the
-- studio has not seen yet, and it must not be publicly readable.
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE "profile_drafts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "profile_drafts" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "profile_drafts" FROM anon, authenticated;
