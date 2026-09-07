
-- CreateEnum
CREATE TYPE "AuthChannel" AS ENUM ('EMAIL', 'WHATSAPP');

-- DropIndex
DROP INDEX "sessions_token_key";

-- AlterTable
ALTER TABLE "sessions" DROP COLUMN "token",
ADD COLUMN     "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "tokenHash" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailVerified" TIMESTAMP(3),
ALTER COLUMN "phone" DROP NOT NULL;

-- DropTable
DROP TABLE "otp_challenges";

-- CreateTable
CREATE TABLE "login_challenges" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "channel" "AuthChannel" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "login_challenges_tokenHash_key" ON "login_challenges"("tokenHash");

-- CreateIndex
CREATE INDEX "login_challenges_identifier_createdAt_idx" ON "login_challenges"("identifier", "createdAt");

-- CreateIndex
CREATE INDEX "login_challenges_expiresAt_idx" ON "login_challenges"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- ── RLS for anything this migration created ──
--
-- Not optional, and not a copy-paste habit: Supabase exposes every public
-- table through PostgREST, and a table created by a Prisma migration does NOT
-- get RLS the way one created in the Supabase UI does. `login_challenges`
-- holds sign-in token hashes; leaving it reachable by the publishable key
-- would be worse than the roster leak this repo already had once.
--
-- Run this block in EVERY migration that adds a table. There is a check for it
-- in docs/DEPLOY-CHECKLIST.md.
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE '\_prisma%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
