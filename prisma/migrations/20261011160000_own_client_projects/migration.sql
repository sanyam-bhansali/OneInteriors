-- A studio's own clients (owner, 11 Oct 2026;
-- docs/studio-workspace/OWN-CLIENTS.md): a studio may start a project for a
-- client who did not come through One Interiors, from a quotation that client
-- accepted, and invite them to the app to follow it.
--
-- The project hangs off an Introduction like every other, so every existing
-- read (customer app, studio workspace, site mode, payments, snags) keeps
-- working unchanged. What is new:
-- * `introductions.source`: ONE_INTERIORS (every existing row, by default)
--   or STUDIO_OWN_CLIENT. Ops queues, introduction counts and anything that
--   treats an introduction as One Interiors-sourced read ONE_INTERIORS only.
-- * `briefs.madeByStudio`: the minimal brief made for an own client who had
--   no account, kept out of One Interiors' funnel.
-- * `home_project_invites`: the invite to the app (code, phone, channels
--   used, joined).
--
-- Expand-only: one enum, two columns with defaults, one table. Nothing is
-- dropped, renamed or backfilled. Safe to `db:deploy`.
-- CreateEnum
CREATE TYPE "IntroductionSource" AS ENUM ('ONE_INTERIORS', 'STUDIO_OWN_CLIENT');

-- AlterTable
ALTER TABLE "briefs" ADD COLUMN     "madeByStudio" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "introductions" ADD COLUMN     "source" "IntroductionSource" NOT NULL DEFAULT 'ONE_INTERIORS';

-- CreateTable
CREATE TABLE "home_project_invites" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "createdById" TEXT,
    "sentVia" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "joinedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "home_project_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "home_project_invites_code_key" ON "home_project_invites"("code");

-- CreateIndex
CREATE INDEX "home_project_invites_projectId_idx" ON "home_project_invites"("projectId");

-- CreateIndex
CREATE INDEX "home_project_invites_userId_idx" ON "home_project_invites"("userId");

-- CreateIndex
CREATE INDEX "home_project_invites_createdById_idx" ON "home_project_invites"("createdById");

-- AddForeignKey
ALTER TABLE "home_project_invites" ADD CONSTRAINT "home_project_invites_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "home_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_project_invites" ADD CONSTRAINT "home_project_invites_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "studio_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- RLS (HANDOVER: every migration that adds a table carries it). Prisma
-- connects as a role that bypasses RLS; PostgREST's anon/authenticated get
-- nothing.
ALTER TABLE "home_project_invites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "home_project_invites" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "home_project_invites" FROM anon, authenticated;
